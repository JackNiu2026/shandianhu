/**
 * 构建前注入微信 AppID
 * 从环境变量 WECHAT_APPID 读取，写入 project.config.json
 * 如果环境变量未设置且当前 appid 为占位符，则报错终止构建
 */
const fs = require("fs");
const path = require("path");

const PROJECT_CONFIG = path.resolve(__dirname, "..", "project.config.json");
const PLACEHOLDER_APPID = "wx0000000000000000";

const envAppid = process.env.WECHAT_APPID;
const config = JSON.parse(fs.readFileSync(PROJECT_CONFIG, "utf8"));

if (envAppid) {
  config.appid = envAppid;
  fs.writeFileSync(PROJECT_CONFIG, JSON.stringify(config, null, 2) + "\n");
  console.log(`[appid] 已从环境变量注入 AppID: ${envAppid}`);
} else if (config.appid === PLACEHOLDER_APPID) {
  console.error("[appid] 错误: WECHAT_APPID 未设置且 appid 仍为占位符 wx0000000000000000");
  console.error("[appid] 请设置环境变量: set WECHAT_APPID=wx你的真实appid");
  console.error("[appid] 或直接修改 packages/mobile/project.config.json 中的 appid");
  process.exit(1);
} else {
  console.log(`[appid] 使用 project.config.json 中的 AppID: ${config.appid}`);
}
