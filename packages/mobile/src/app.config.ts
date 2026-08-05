export default defineAppConfig({
  pages: [
    "pages/match/index",
    "pages/test/index",
    "pages/chat/index",
    "pages/me/index",
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#fff",
    navigationBarTitleText: "闪电虎",
    navigationBarTextStyle: "black",
    backgroundColor: "#f1ece4",
  },
  tabBar: {
    custom: true,
    color: "#6B6B6B",
    selectedColor: "#967AE9",
    borderStyle: "white",
    backgroundColor: "#ffffff",
    list: [
      {
        pagePath: "pages/match/index",
        text: "发现",
      },
      {
        pagePath: "pages/test/index",
        text: "测评",
      },
      {
        pagePath: "pages/chat/index",
        text: "消息",
      },
      {
        pagePath: "pages/me/index",
        text: "我的",
      },
    ],
  },
});
