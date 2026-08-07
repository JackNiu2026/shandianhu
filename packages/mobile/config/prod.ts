export default {
  mini: {},
  h5: {},
  // 生产环境 API 地址（部署时修改为实际域名）
  // 注意：值必须用 JSON.stringify 包裹，否则 DefinePlugin 会将 URL 原样替换
  // 导致 https:// 被解析为 label + 注释，引发 SyntaxError
  env: {
    TARO_APP_API_BASE: JSON.stringify("https://api.lightning-tiger.com"),
  },
};
