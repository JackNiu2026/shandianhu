import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAppStore } from "@/store";
import TopBar from "@/components/TopBar";
import "./index.scss";

export default function LearningPage() {
  const { state } = useAppStore();

  function openAssessment(path: string) {
    if (!state.activeChild) {
      Taro.showToast({ title: "请先在我的页面选择孩子", icon: "none" });
      void Taro.switchTab({ url: "/pages/me/index" });
      return;
    }
    void Taro.navigateTo({ url: path });
  }

  return <View className="learning-page lt-page">
    <TopBar />
    <View className="lt-content learning-content">
      <Text className="lt-eyebrow">LEARNING PROFILE</Text>
      <Text className="lt-page-title">学情</Text>
      <Text className="lt-page-intro">从真实学习证据出发，逐步建立可解释、会更新的学习画像。</Text>

      <View className="profile-overview lt-card">
        <Text className="overview-kicker">学习画像</Text>
        <Text className="overview-title">认识学习方式，也看见具体问题</Text>
        <View className="overview-points"><Text>学习偏好</Text><Text>错题证据</Text><Text>持续更新</Text></View>
      </View>

      <View className="lt-section-head"><Text className="lt-section-title">评估工具</Text></View>
      <View className="assessment-item lt-card">
        <View className="assessment-index">01</View>
        <View className="assessment-copy"><Text className="item-title">学习风格测评</Text><Text className="item-description">28 题 · 约 5 分钟 · 结果可重测</Text></View>
        <Button className="assessment-action lt-primary" onClick={() => openAssessment("/pages/assessment-style/index")}>开始测评</Button>
      </View>
      <View className="assessment-item lt-card">
        <View className="assessment-index action">02</View>
        <View className="assessment-copy"><Text className="item-title">错题诊断</Text><Text className="item-description">上传真实错题，生成知识点与错误类型证据</Text></View>
        <Button className="assessment-action lt-primary" onClick={() => openAssessment("/pages/assessment-wrong/index")}>上传错题</Button>
      </View>
    </View>
  </View>;
}
