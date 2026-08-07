// Chart initialization for production readiness audit report
(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim() || '#2563EB';
  var accent2 = style.getPropertyValue('--accent2').trim() || '#DC2626';
  var accent3 = style.getPropertyValue('--accent3').trim() || '#059669';
  var warn = style.getPropertyValue('--warn').trim() || '#D97706';
  var ink = style.getPropertyValue('--ink').trim() || '#1A1D27';
  var muted = style.getPropertyValue('--muted').trim() || '#6B7280';
  var rule = style.getPropertyValue('--rule').trim() || '#E5E7EB';
  var bg2 = style.getPropertyValue('--bg2').trim() || '#FFFFFF';

  // --- Chart 1: Readiness Radar ---
  var radarChart = echarts.init(document.getElementById('chart-radar'), null, { renderer: 'svg' });
  radarChart.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true
    },
    legend: {
      data: ['当前就绪度', '上线标准'],
      bottom: 0,
      textStyle: { color: muted, fontSize: 12 }
    },
    radar: {
      indicator: [
        { name: '认证体系', max: 100 },
        { name: 'API 集成', max: 100 },
        { name: '状态管理', max: 100 },
        { name: 'UI/样式', max: 100 },
        { name: '安全防护', max: 100 },
        { name: '数据模型', max: 100 },
        { name: '页面功能', max: 100 },
        { name: 'Docker 配置', max: 100 },
        { name: 'CI/CD', max: 100 },
        { name: '环境配置', max: 100 }
      ],
      radius: '65%',
      center: ['50%', '48%'],
      splitArea: {
        areaStyle: {
          color: [bg2, '#F9FAFB', bg2, '#F9FAFB'],
          opacity: 0.3
        }
      },
      axisLine: { lineStyle: { color: rule } },
      splitLine: { lineStyle: { color: rule } },
      axisName: {
        color: ink,
        fontSize: 11,
        fontWeight: 600
      }
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [0, 50, 80, 90, 40, 80, 70, 60, 50, 30],
          name: '当前就绪度',
          areaStyle: { color: accent, opacity: 0.15 },
          lineStyle: { color: accent, width: 2 },
          itemStyle: { color: accent },
          symbolSize: 5
        },
        {
          value: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
          name: '上线标准',
          areaStyle: { color: accent2, opacity: 0.05 },
          lineStyle: { color: accent2, width: 1, type: 'dashed' },
          itemStyle: { color: accent2 },
          symbolSize: 4
        }
      ]
    }]
  });
  window.addEventListener('resize', function () { radarChart.resize(); });

  // --- Chart 2: Issues by Severity and Module ---
  var issuesChart = echarts.init(document.getElementById('chart-issues'), null, { renderer: 'svg' });
  issuesChart.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      appendToBody: true
    },
    legend: {
      data: ['P0 阻断', 'P1 高优先级', 'P2 中优先级'],
      bottom: 0,
      textStyle: { color: muted, fontSize: 12 }
    },
    grid: {
      left: '8%',
      right: '5%',
      top: '8%',
      bottom: '15%'
    },
    xAxis: {
      type: 'category',
      data: ['移动端', '管理端', '基础设施'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: ink, fontSize: 13, fontWeight: 600 }
    },
    yAxis: {
      type: 'value',
      max: 8,
      splitLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11 }
    },
    series: [
      {
        name: 'P0 阻断',
        type: 'bar',
        data: [6, 4, 5],
        itemStyle: { color: accent2, borderRadius: [4, 4, 0, 0] },
        barWidth: '20%',
        label: { show: true, position: 'top', color: accent2, fontSize: 12, fontWeight: 700 }
      },
      {
        name: 'P1 高优先级',
        type: 'bar',
        data: [6, 7, 5],
        itemStyle: { color: warn, borderRadius: [4, 4, 0, 0] },
        barWidth: '20%',
        label: { show: true, position: 'top', color: warn, fontSize: 12, fontWeight: 700 }
      },
      {
        name: 'P2 中优先级',
        type: 'bar',
        data: [6, 7, 6],
        itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] },
        barWidth: '20%',
        label: { show: true, position: 'top', color: accent, fontSize: 12, fontWeight: 700 }
      }
    ]
  });
  window.addEventListener('resize', function () { issuesChart.resize(); });

  // --- Chart 3: Workload Estimation ---
  var workloadChart = echarts.init(document.getElementById('chart-workload'), null, { renderer: 'svg' });
  workloadChart.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      appendToBody: true,
      formatter: function (params) {
        var html = '<div style="font-weight:600;margin-bottom:4px;">' + params[0].name + '</div>';
        params.forEach(function (p) {
          html += '<div style="color:' + p.color + ';">' + p.seriesName + ': ' + p.value + 'h</div>';
        });
        return html;
      }
    },
    legend: {
      data: ['P0 工时', 'P1 工时'],
      bottom: 0,
      textStyle: { color: muted, fontSize: 12 }
    },
    grid: {
      left: '8%',
      right: '5%',
      top: '8%',
      bottom: '15%'
    },
    xAxis: {
      type: 'category',
      data: ['移动端', '管理端', '基础设施'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: ink, fontSize: 13, fontWeight: 600 }
    },
    yAxis: {
      type: 'value',
      name: '工时 (小时)',
      nameTextStyle: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11 }
    },
    series: [
      {
        name: 'P0 工时',
        type: 'bar',
        data: [14.5, 6.5, 10],
        itemStyle: {
          color: accent2,
          borderRadius: [4, 4, 0, 0]
        },
        barWidth: '30%',
        label: { show: true, position: 'top', color: accent2, fontSize: 12, fontWeight: 700, formatter: '{c}h' }
      },
      {
        name: 'P1 工时',
        type: 'bar',
        data: [10, 11, 2],
        itemStyle: {
          color: warn,
          borderRadius: [4, 4, 0, 0]
        },
        barWidth: '30%',
        label: { show: true, position: 'top', color: warn, fontSize: 12, fontWeight: 700, formatter: '{c}h' }
      }
    ]
  });
  window.addEventListener('resize', function () { workloadChart.resize(); });
})();
