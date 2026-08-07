export default {
  logger: {
    quiet: false,
    stats: true,
  },
  mini: {},
  h5: {},
  // 环境变量（通过 process.env.TARO_APP_* 访问）
  // 注意：值必须用 JSON.stringify 包裹，否则 DefinePlugin 会将 URL 原样替换
  // 导致 http:// 被解析为 label + 注释，引发 SyntaxError
  env: {
    TARO_APP_API_BASE: JSON.stringify("http://localhost:3000"),
  },
};
