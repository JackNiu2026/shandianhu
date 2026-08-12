import { useEffect, useState } from "react";
import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { createReportShare, fetchLearningReport, fetchLearningReportPdf, type LearningReport } from "@/services/api";
import "./index.scss";

export default function ReportPage() {
  const reportId = Taro.getCurrentInstance().router?.params?.id;
  const [report, setReport] = useState<LearningReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      return;
    }
    void fetchLearningReport(reportId).then(setReport).catch(() => {
      Taro.showToast({ title: "报告暂不可用", icon: "none" });
    }).finally(() => setLoading(false));
  }, [reportId]);

  async function downloadPdf() {
    if (!report) return;
    try {
      const { downloadUrl } = await fetchLearningReportPdf(report.id);
      const result = await Taro.downloadFile({ url: downloadUrl });
      await Taro.openDocument({ filePath: result.tempFilePath, showMenu: true });
    } catch {
      Taro.showToast({ title: "PDF 暂不可下载", icon: "none" });
    }
  }

  async function createShareLink() {
    if (!report) return;
    try {
      const { token } = await createReportShare(report.id);
      const link = `${process.env.TARO_APP_API_BASE || ""}/share/reports/${token}`;
      await Taro.setClipboardData({ data: link });
      Taro.showToast({ title: "分享链接已复制", icon: "success" });
    } catch {
      Taro.showToast({ title: "暂无法创建分享", icon: "none" });
    }
  }

  if (loading) return <View className="report-page centered"><Text>报告加载中</Text></View>;
  if (!report) return <View className="report-page centered"><Text>未找到可查看的报告</Text></View>;

  const confidence = report.body.confidence === null ? "暂无法计算" : `${Math.round(report.body.confidence * 100)}%`;
  return <View className="report-page">
    <Text className="title">学习情况报告</Text>
    <Text className="meta">第 {report.sequence} 版</Text>
    <View className="summary">
      <View><Text className="label">证据数量</Text><Text className="value">{report.body.evidenceCount}</Text></View>
      <View><Text className="label">当前可信度</Text><Text className="value">{confidence}</Text></View>
    </View>
    <View className="advice">
      <Text className="section-title">学习建议</Text>
      <Text className="body">结合报告中的证据范围，安排后续学习与复盘。</Text>
    </View>
    <View className="actions">
      <Button className="secondary" disabled={!report.hasPdf} onClick={downloadPdf}>查看 PDF</Button>
      <Button className="primary" disabled={report.status !== "READY"} onClick={createShareLink}>生成分享链接</Button>
    </View>
  </View>;
}
