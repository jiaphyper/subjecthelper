// pm2 进程配置：pm2 startOrReload deploy/ecosystem.config.cjs
const path = require("path");
const PORT = process.env.PORT || "5000";
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, "../../subjecthelper-data");

module.exports = {
  apps: [
    {
      name: "subjecthelper",
      cwd: path.resolve(__dirname, ".."),
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${PORT} -H 0.0.0.0`,
      env: { NODE_ENV: "production", PORT, DATA_DIR },
      max_memory_restart: "600M",
      time: true,
    },
  ],
};
