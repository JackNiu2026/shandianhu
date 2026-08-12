import { Component } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { NavIcon } from "./Icons";
import "./TeacherWorkspaceNav.scss";

// 老师端 4 个 tab：工作 / 课程 / 学生 / 我的
const TABS = [
  { pagePath: "pages/teacher-work/index", text: "工作", icon: "discover" as const, activeColor: "#7056BD" },
  { pagePath: "pages/teacher-lessons/index", text: "课程", icon: "assessment" as const, activeColor: "#27826b" },
  { pagePath: "pages/teacher-students/index", text: "学生", icon: "diagnose" as const, activeColor: "#C96542" },
  { pagePath: "pages/teacher-me/index", text: "我的", icon: "profile" as const, activeColor: "#4E70AD" },
];

const INACTIVE_COLOR = "#8A827A";

/** 根据当前路由获取选中的 tab 索引 */
function getSelectedIndex(): number {
  try {
    const instance = Taro.getCurrentInstance();
    const path = instance?.router?.path || "";
    const idx = TABS.findIndex((t) => path.includes(t.pagePath));
    return idx >= 0 ? idx : 0;
  } catch {
    return 0;
  }
}

/**
 * 老师端固定底部导航。
 *
 * 老师页面不加入原生 tabBar，由本组件渲染 4 个 tab（工作/课程/学生/我的）。
 * 点击通过 Taro.reLaunch 跳转，避免依赖原生 switchTab。
 */
export class TeacherWorkspaceNav extends Component {
  state = {
    selected: 0,
  };

  componentDidMount() {
    this.setState({ selected: getSelectedIndex() });
  }

  componentDidUpdate() {
    const current = getSelectedIndex();
    if (current !== this.state.selected) {
      this.setState({ selected: current });
    }
  }

  switchTo = (index: number, pagePath: string) => {
    this.setState({ selected: index });
    // 老师页面不在原生 tabBar 中，使用 reLaunch 跳转
    Taro.reLaunch({ url: "/" + pagePath });
  };

  render() {
    return (
      <View className="teacher-bottom-nav">
        {TABS.map((tab, index) => (
          <View
            key={tab.pagePath}
            className={`teacher-nav-btn ${this.state.selected === index ? "active" : ""}`}
            onClick={() => this.switchTo(index, tab.pagePath)}
          >
            <NavIcon
              name={tab.icon}
              color={this.state.selected === index ? tab.activeColor : INACTIVE_COLOR}
            />
            <Text className="teacher-nav-label">{tab.text}</Text>
          </View>
        ))}
      </View>
    );
  }
}

export default TeacherWorkspaceNav;
