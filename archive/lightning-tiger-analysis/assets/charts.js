(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var danger = style.getPropertyValue('--danger').trim();
  var success = style.getPropertyValue('--success').trim();
  var notice = style.getPropertyValue('--notice').trim();

  // --- Chart 1: Code Distribution ---
  var chart1 = echarts.init(document.getElementById('chart-code-distribution'), null, { renderer: 'svg' });
  chart1.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    legend: { data: ['页面/路由', '组件', '工具/数据层', '样式', '配置'], bottom: 0, textStyle: { color: muted, fontSize: 11 } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['shared 共享包', 'mobile C端', 'admin B端', 'figma 原型'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      name: '文件数',
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    },
    series: [
      { name: '页面/路由', type: 'bar', stack: 'total', itemStyle: { color: accent }, data: [0, 4, 13, 1] },
      { name: '组件', type: 'bar', stack: 'total', itemStyle: { color: accent2 }, data: [0, 2, 16, 0] },
      { name: '工具/数据层', type: 'bar', stack: 'total', itemStyle: { color: success }, data: [4, 1, 4, 0] },
      { name: '样式', type: 'bar', stack: 'total', itemStyle: { color: notice }, data: [0, 5, 1, 2] },
      { name: '配置', type: 'bar', stack: 'total', itemStyle: { color: muted }, data: [1, 3, 3, 2] }
    ]
  });
  window.addEventListener('resize', function() { chart1.resize(); });

  // --- Chart 2: Go-Live Readiness Radar ---
  var chart2 = echarts.init(document.getElementById('chart-readiness'), null, { renderer: 'svg' });
  chart2.setOption({
    animation: false,
    tooltip: { appendToBody: true },
    radar: {
      indicator: [
        { name: '前端UI完成度', max: 100 },
        { name: '后端服务', max: 100 },
        { name: '数据持久化', max: 100 },
        { name: '用户认证', max: 100 },
        { name: '测试覆盖', max: 100 },
        { name: '部署运维', max: 100 },
        { name: '安全防护', max: 100 },
        { name: 'App端适配', max: 100 }
      ],
      axisName: { color: ink, fontSize: 12 },
      splitLine: { lineStyle: { color: rule } },
      splitArea: { areaStyle: { color: [bg2, 'transparent'] } },
      axisLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'radar',
      data: [{
        value: [78, 5, 0, 10, 0, 0, 15, 5],
        name: '当前就绪度',
        areaStyle: { color: accent + '33' },
        lineStyle: { color: accent, width: 2 },
        itemStyle: { color: accent }
      }]
    }]
  });
  window.addEventListener('resize', function() { chart2.resize(); });

  // --- Chart 3: Risk Distribution ---
  var chart3 = echarts.init(document.getElementById('chart-risks'), null, { renderer: 'svg' });
  chart3.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true, formatter: '{b}: {c} 项 ({d}%)' },
    legend: { bottom: 0, textStyle: { color: muted, fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      label: { color: ink, fontSize: 12, formatter: '{b}\n{c}项' },
      labelLine: { lineStyle: { color: rule } },
      data: [
        { value: 4, name: 'P0 严重', itemStyle: { color: danger } },
        { value: 6, name: 'P1 高', itemStyle: { color: '#F97316' } },
        { value: 8, name: 'P2 中', itemStyle: { color: notice } },
        { value: 4, name: 'P3 低', itemStyle: { color: muted } }
      ]
    }]
  });
  window.addEventListener('resize', function() { chart3.resize(); });

  // --- Chart 4: Feature Closure Rate ---
  var chart4 = echarts.init(document.getElementById('chart-closure'), null, { renderer: 'svg' });
  chart4.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '5%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      max: 100,
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: ['平台统计', '消息聊天', '角色切换', '老师名片海报', '排课管理', '会员订阅', '内容配置', '老师收益', '老师评价', 'MBTI测评', '免费试听预约', '家长收藏', '老师核验', '老师匹配'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: ink, fontSize: 11 }
    },
    series: [{
      type: 'bar',
      data: [
        { value: 25, itemStyle: { color: danger } },
        { value: 0, itemStyle: { color: danger } },
        { value: 0, itemStyle: { color: danger } },
        { value: 0, itemStyle: { color: danger } },
        { value: 0, itemStyle: { color: danger } },
        { value: 30, itemStyle: { color: notice } },
        { value: 35, itemStyle: { color: notice } },
        { value: 40, itemStyle: { color: notice } },
        { value: 50, itemStyle: { color: '#F97316' } },
        { value: 50, itemStyle: { color: '#F97316' } },
        { value: 50, itemStyle: { color: '#F97316' } },
        { value: 50, itemStyle: { color: '#F97316' } },
        { value: 80, itemStyle: { color: success } },
        { value: 50, itemStyle: { color: '#F97316' } }
      ],
      label: { show: true, position: 'right', formatter: '{c}%', color: ink, fontSize: 11 }
    }]
  });
  window.addEventListener('resize', function() { chart4.resize(); });

  // --- Chart 5: Tech Stack Score ---
  var chart5 = echarts.init(document.getElementById('chart-techstack'), null, { renderer: 'svg' });
  chart5.setOption({
    animation: false,
    tooltip: { trigger: 'axis', appendToBody: true, axisPointer: { type: 'shadow' } },
    legend: { data: ['当前评分', '最佳实践基准'], bottom: 0, textStyle: { color: muted, fontSize: 11 } },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['框架选型', '状态管理', '样式方案', '类型安全', '数据层', 'API设计', '测试体系', '双端复用'],
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11, rotate: 15 }
    },
    yAxis: {
      type: 'value',
      max: 10,
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } }
    },
    series: [
      { name: '当前评分', type: 'bar', itemStyle: { color: accent }, data: [8, 5, 7, 7, 3, 2, 0, 4] },
      { name: '最佳实践基准', type: 'bar', itemStyle: { color: accent2 }, data: [9, 7, 8, 9, 8, 8, 8, 8] }
    ]
  });
  window.addEventListener('resize', function() { chart5.resize(); });
})();
