import { Component } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

const tabs = [
  { pagePath: "pages/match/index", text: "发现", icon: "discover" },
  { pagePath: "pages/test/index", text: "测评", icon: "assessment" },
  { pagePath: "pages/chat/index", text: "消息", icon: "chat" },
  { pagePath: "pages/me/index", text: "我的", icon: "profile" },
];

export default class CustomTabBar extends Component {
  state = {
    selected: 0,
  };

  switchTab = (index: number, pagePath: string) => {
    const selected = index;
    this.setState({ selected });
    Taro.switchTab({ url: "/" + pagePath });
  };

  render() {
    return (
      <View className="bottom-nav">
        {tabs.map((tab, index) => (
          <View
            key={tab.pagePath}
            className={this.state.selected === index ? "selected" : ""}
            onClick={() => this.switchTab(index, tab.pagePath)}
          >
            <Text className="nav-symbol nav-icon-{tab.icon}">{tab.icon === "discover" ? "✦" : tab.icon === "assessment" ? "▣" : tab.icon === "chat" ? "✉" : "◉"}</Text>
            <Text>{tab.text}</Text>
          </View>
        ))}
      </View>
    );
  }
}
