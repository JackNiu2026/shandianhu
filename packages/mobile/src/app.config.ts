export default defineAppConfig({
  pages: [
    "pages/smart/index",
    "pages/chat-history/index",
    "pages/tutors/index",
    "pages/learning/index",
    "pages/me/index",
    "pages/assessment-style/index",
    "pages/assessment-wrong/index",
    "pages/report/index",
    // V2.3 老师端页面（不在原生 tabBar，使用 TeacherWorkspaceNav）
    "pages/teacher-apply/index",
    "pages/teacher-schedule/index",
    "pages/teacher-work/index",
    "pages/teacher-lessons/index",
    "pages/teacher-students/index",
    "pages/teacher-feedback/index",
    "pages/teacher-me/index",
    // V2.3 家长端真人家教页面（通过 navigateTo 跳转）
    "pages/tutor-detail/index",
    "pages/trial-booking/index",
    "pages/trial-status/index",
    "pages/lesson-review/index",
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
    selectedColor: "#6049AD",
    borderStyle: "white",
    backgroundColor: "#ffffff",
    list: [
      {
        pagePath: "pages/smart/index",
        text: "智学",
      },
      {
        pagePath: "pages/tutors/index",
        text: "家教",
      },
      {
        pagePath: "pages/learning/index",
        text: "学情",
      },
      {
        pagePath: "pages/me/index",
        text: "我的",
      },
    ],
  },
});
