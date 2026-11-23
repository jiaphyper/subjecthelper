#!/usr/bin/env bash
# 服务器首次初始化（Ubuntu 20.04+ / 22.04 / 24.04），在服务器上以普通用户（如 ubuntu）运行一次：
#   bash server-setup.sh
# 会安装 Node.js 22、pm2、编译工具，生成 GitHub 部署密钥，克隆仓库并首次部署。
set -euo pipefail

REPO="${REPO:-jiaphyper/subjecthelper}"
APP_DIR="${APP_DIR:-$HOME/apps/subjecthelper}"
DATA_DIR="${DATA_DIR:-$HOME/apps/subjecthelper-data}"
PORT="${PORT:-5000}"
KEY="$HOME/.ssh/subjecthelper_deploy"
step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

step "安装系统依赖（git / curl / 编译工具，better-sqlite3 需要）"
sudo apt-get update -y
sudo apt-get install -y git curl build-essential python3 ca-certificates

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  step "安装 Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v && npm -v

if ! command -v pm2 >/dev/null; then
  step "安装 pm2"
  sudo npm install -g pm2
fi

step "GitHub 部署密钥（只读）"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ ! -f "$KEY" ]; then
  ssh-keygen -t ed25519 -N "" -C "subjecthelper-deploy@$(hostname)" -f "$KEY"
fi
if ! grep -q "Host github-subjecthelper" "$HOME/.ssh/config" 2>/dev/null; then
  cat >> "$HOME/.ssh/config" <<CFG

# subjecthelper 部署（走 443 端口，国内服务器更稳定）
Host github-subjecthelper
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile $KEY
  IdentitiesOnly yes
CFG
  chmod 600 "$HOME/.ssh/config"
fi
ssh-keyscan -p 443 ssh.github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true

echo
echo "请把下面这行公钥添加到 GitHub：仓库 $REPO → Settings → Deploy keys → Add deploy key（不要勾选 Allow write access）"
echo "-----------------------------------------------------------------"
cat "$KEY.pub"
echo "-----------------------------------------------------------------"
read -r -p "添加好后按回车继续…" _
# 注意：认证成功时 ssh -T 也会返回退出码 1（GitHub 不提供 shell），所以先取输出再判断
for i in 1 2 3; do
  OUT="$(ssh -o ConnectTimeout=15 -T git@github-subjecthelper 2>&1 || true)"
  if echo "$OUT" | grep -qi "successfully authenticated"; then echo "✅ GitHub 连接成功"; break; fi
  echo "$OUT"
  if [ "$i" = 3 ]; then
    echo "❌ 连接 GitHub 失败：Permission denied 说明 Deploy key 没加对；超时说明服务器连不上 ssh.github.com:443"
    exit 1
  fi
  read -r -p "检查后按回车重试…" _
done

step "克隆仓库"
mkdir -p "$(dirname "$APP_DIR")" "$DATA_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "git@github-subjecthelper:$REPO.git" "$APP_DIR"
else
  git -C "$APP_DIR" remote set-url origin "git@github-subjecthelper:$REPO.git"
fi

step "首次部署"
APP_DIR="$APP_DIR" DATA_DIR="$DATA_DIR" PORT="$PORT" bash "$APP_DIR/deploy/server-update.sh"

step "开机自启"
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" | tail -n 1
pm2 save

if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then
  sudo ufw allow "$PORT"/tcp
fi

echo
echo "🎉 完成。访问 http://<服务器IP>:$PORT ，默认管理员 admin / admin123，请立即修改密码。"
echo "   数据目录：$DATA_DIR （数据库 app.db，备份在 backups/）"
echo "   如果是云服务器，记得在控制台的安全组里放行 TCP $PORT 端口。"
