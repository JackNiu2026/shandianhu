import { Component } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { NavIcon } from "../components/Icons";
import "./index.scss";

const tabs = [
  { pagePath: "pages/match/index", text: "发现", icon: "discover" as const, activeColor: "#7056BD" },
  { pagePath: "pages/test/index", text: "测评", icon: "assessment" as const, activeColor: "#C96542" },
  { pagePath: "pages/me/index", text: "我的", icon: "profile" as const, activeColor: "#4E70AD" },
];

const INACTIVE_COLOR = "#8A827A";

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
