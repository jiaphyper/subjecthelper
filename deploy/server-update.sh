#!/usr/bin/env bash
# 在服务器上执行：拉取最新代码 → 备份数据库 → 安装依赖 → 构建 → 重启。
# 由本地 ./deploy/remote-deploy.sh 通过 ssh 调用，也可以在服务器上直接运行。
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/apps/subjecthelper}"
DATA_DIR="${DATA_DIR:-$HOME/apps/subjecthelper-data}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-5000}"
export DATA_DIR PORT

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

cd "$APP_DIR"

step "拉取代码 ($BRANCH)"
OLD="$(git rev-parse HEAD 2>/dev/null || echo none)"
git fetch origin "$BRANCH" --prune
git checkout -q "$BRANCH" 2>/dev/null || git checkout -q -b "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"   # 服务器上的代码以 GitHub 为准
NEW="$(git rev-parse HEAD)"
git log --oneline -1
if [ "$OLD" = "$NEW" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "代码没有变化（设置 FORCE=1 可强制重新构建）"
fi

step "备份数据库"
mkdir -p "$DATA_DIR/backups"
if [ -f "$DATA_DIR/app.db" ] && [ -d node_modules/better-sqlite3 ]; then
  BK="$DATA_DIR/backups/app-$(date +%Y%m%d-%H%M%S).db"
  node -e "require('better-sqlite3')(process.argv[1]).backup(process.argv[2]).then(()=>console.log('已备份到', process.argv[2]))" "$DATA_DIR/app.db" "$BK"
  ls -1t "$DATA_DIR"/backups/app-*.db | tail -n +21 | xargs -r rm -f   # 只保留最近 20 份
else
  echo "还没有数据库，跳过"
fi

if [ "$OLD" = "none" ] || [ ! -d node_modules ] || ! git diff --quiet "$OLD" "$NEW" -- package.json package-lock.json; then
  step "安装依赖"
  npm ci --no-audit --no-fund
fi

if [ "$OLD" != "$NEW" ] || [ ! -d .next ] || [ "${FORCE:-0}" = "1" ]; then
  step "构建"
  npm run build
fi

step "启动 / 重启 (端口 $PORT)"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save >/dev/null

step "健康检查"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null 2>/dev/null "http://127.0.0.1:$PORT/login"; then
    echo "✅ 部署成功：http://<服务器IP>:$PORT   ($(git log --oneline -1))"
    exit 0
  fi
  sleep 1
done
echo "❌ 服务没有正常响应，最近日志："
pm2 logs subjecthelper --lines 40 --nostream || true
exit 1
