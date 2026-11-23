#!/usr/bin/env bash
# 本地执行：让服务器从 GitHub 拉取最新代码并重新部署。
#
#   ./deploy/remote-deploy.sh            # 部署 main
#   ./deploy/remote-deploy.sh dev        # 部署其它分支
#   FORCE=1 ./deploy/remote-deploy.sh    # 代码没变也强制重新构建
#
# 可用环境变量覆盖默认值（也可以写在 deploy/.env.deploy 里）：
#   DEPLOY_HOST  ssh 主机名（~/.ssh/config 里的 Host），默认 exambuilder
#   DEPLOY_DIR   服务器上的代码目录，默认 ~/apps/subjecthelper
#   DEPLOY_DATA  服务器上的数据目录，默认 ~/apps/subjecthelper-data
#   DEPLOY_PORT  端口，默认 5000
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f deploy/.env.deploy ] && . deploy/.env.deploy

HOST="${DEPLOY_HOST:-exambuilder}"
APP_DIR="${DEPLOY_DIR:-~/apps/subjecthelper}"
DATA_DIR="${DEPLOY_DATA:-~/apps/subjecthelper-data}"
PORT="${DEPLOY_PORT:-5000}"
BRANCH="${1:-${DEPLOY_BRANCH:-main}}"

confirm() { read -r -p "$1 [y/N] " a; [[ "$a" =~ ^[Yy]$ ]]; }

# 1. 本地检查：服务器只会拉取 GitHub 上的代码
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  本地有未提交的改动，这些改动不会被部署："
  git status --short
  confirm "仍然继续部署 GitHub 上的 $BRANCH？" || exit 1
fi
git fetch -q origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL" != "$REMOTE" ]; then
  if git merge-base --is-ancestor "$REMOTE" "$LOCAL"; then
    echo "⚠️  本地有 $(git rev-list --count "$REMOTE..$LOCAL") 个提交还没推送到 GitHub。"
    if confirm "先 git push 再部署？"; then git push origin "$BRANCH"; fi
  else
    echo "ℹ️  本地 $BRANCH 和 GitHub 不一致，将部署 GitHub 上的版本：$(git log --oneline -1 "origin/$BRANCH")"
  fi
fi

echo "🚀 部署 $BRANCH → $HOST:$APP_DIR (端口 $PORT)"
# 2. 在服务器上执行 deploy/server-update.sh（用本地这份脚本，保证和代码同步）
ssh "$HOST" "APP_DIR=$APP_DIR DATA_DIR=$DATA_DIR BRANCH=$BRANCH PORT=$PORT FORCE=${FORCE:-0} bash -s" < deploy/server-update.sh
