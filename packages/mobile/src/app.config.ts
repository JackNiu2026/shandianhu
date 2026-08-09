export default defineAppConfig({
  pages: [
    "pages/match/index",
    "pages/test/index",
    "pages/diagnose/index",
    "pages/me/index",
  ],
  window: {
    backgroundTextStyle: "light",
    // 自定义导航:由 components/TopBar 渲染品牌顶栏(对齐 Figma topbar)
    navigationStyle: "custom",
    navigationBarBackgroundColor: "#FFFCF9",
    navigationBarTitleText: "闪电虎",
    navigationBarTextStyle: "black",
    // 与设计稿 --surface-base 一致(下拉 overscroll 时可见)
    backgroundColor: "#F5F2F0",
  },
  tabBar: {
    custom: true,
    color: "#8A827A",
    selectedColor: "#7056BD",
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
        pagePath: "pages/me/index",
        text: "我的",
      },
    ],
  },
});
