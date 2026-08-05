export default {
  logger: {
    quiet: false,
    stats: true,
  },
  mini: {},
  h5: {},
  // 环境变量（通过 process.env.TARO_APP_* 访问）
  env: {
    TARO_APP_API_BASE: "http://localhost:3000",
  },
};
