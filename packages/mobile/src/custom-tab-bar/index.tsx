import { Component } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { NavIcon } from "../components/Icons";
import "./index.scss";

const tabs = [
  { pagePath: "pages/smart/index", text: "智学", icon: "discover" as const, activeColor: "#6049AD" },
  { pagePath: "pages/tutors/index", text: "家教", icon: "diagnose" as const, activeColor: "#6049AD" },
  { pagePath: "pages/learning/index", text: "学情", icon: "assessment" as const, activeColor: "#6049AD" },
  { pagePath: "pages/me/index", text: "我的", icon: "profile" as const, activeColor: "#6049AD" },
];

const INACTIVE_COLOR = "#756E69";

/** 根据当前路由获取选中的 tab 索引 */
function getSelectedIndex(): number {
  try {
    const instance = Taro.getCurrentInstance();
    const path = instance?.router?.path || "";
    const idx = tabs.findIndex((t) => path.includes(t.pagePath));
    return idx >= 0 ? idx : 0;
  } catch {
    return 0;
  }
}

export default class CustomTabBar extends Component {
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

  switchTab = (index: number, pagePath: string) => {
    this.setState({ selected: index });
    Taro.switchTab({ url: "/" + pagePath });
  };

  render() {
    return (
      <View className="bottom-nav">
        {tabs.map((tab, index) => (
          <View
            key={tab.pagePath}
            className={`nav-btn ${this.state.selected === index ? "active" : ""}`}
            onClick={() => this.switchTab(index, tab.pagePath)}
          >
            <NavIcon
              name={tab.icon}
              color={this.state.selected === index ? tab.activeColor : INACTIVE_COLOR}
            />
            <Text className="nav-label">{tab.text}</Text>
          </View>
        ))}
      </View>
    );
  }
}
