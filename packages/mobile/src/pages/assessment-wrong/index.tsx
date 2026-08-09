import { useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
const TASK_KEY = "wrong-question-task";
export default function AssessmentWrongPage() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState("等待上传错题图片");
  useEffect(() => { const saved = Taro.getStorageSync(TASK_KEY); if (saved) setTaskId(saved); }, []);
  useEffect(() => { if (!taskId) return; const timer = setInterval(() => setStatus("正在分析"), 2000); return () => clearInterval(timer); }, [taskId]);
  return <View className="assessment-wrong"><Text>错题诊断</Text><Text>{status}</Text>{taskId && <Text>任务已保存，可返回后继续查看</Text>}</View>;
}
