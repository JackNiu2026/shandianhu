(function() {
  // Read CSS variables for chart theming
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim() || '#967AE9';
  var accent2 = style.getPropertyValue('--accent2').trim() || '#FFBE98';
  var ink = style.getPropertyValue('--ink').trim() || '#151617';
  var muted = style.getPropertyValue('--muted').trim() || '#6B6B6B';
  var rule = style.getPropertyValue('--rule').trim() || '#E3DBD2';
  var bg2 = style.getPropertyValue('--bg2').trim() || '#FFFFFF';

  // ========== Mermaid Init ==========
  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      themeVariables: {
        primaryColor: accent,
        primaryTextColor: ink,
        primaryBorderColor: accent,
        lineColor: muted,
        secondaryColor: bg2,
        tertiaryColor: bg2,
        fontFamily: 'Noto Sans SC, sans-serif',
        fontSize: '14px'
      },
      securityLevel: 'loose',
      flowchart: {
        curve: 'basis',
        padding: 20,
        nodeSpacing: 40,
        rankSpacing: 40
      }
    });
  }

  // ========== Chart 1: Animation Keyframes ==========
  var chartAnim = document.getElementById('chart-animations');
  if (chartAnim && window.echarts) {
    var animChart = echarts.init(chartAnim, null, { renderer: 'svg' });
    animChart.setOption({
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        appendToBody: true,
        formatter: function(params) {
          var p = params[0];
          var data = animData[p.dataIndex];
          return '<b>' + data.name + '</b><br/>' +
                 '时长: ' + data.duration + '<br/>' +
                 '曲线: ' + data.curve + '<br/>' +
                 '用途: ' + data.purpose;
        }
      },
      grid: {
        left: '8%',
        right: '5%',
        top: 30,
        bottom: 60
      },
      xAxis: {
        type: 'category',
        data: ['rise', 'dialog-pop', 'playhead', 'swipe-nudge', 'swipe-pulse', 'swipe-overlay', 'swipe-arrow'],
        axisLabel: {
          color: muted,
          fontSize: 11,
          rotate: 25,
          fontFamily: 'DM Mono, monospace'
        },
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '时长 (ms)',
        nameTextStyle: { color: muted, fontSize: 11 },
        axisLabel: { color: muted, fontSize: 11, fontFamily: 'DM Mono, monospace' },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: rule, type: 'dashed' } }
      },
      series: [{
        type: 'bar',
        data: [
          { value: 240, itemStyle: { color: accent } },
          { value: 220, itemStyle: { color: accent } },
          { value: 8000, itemStyle: { color: accent2 } },
          { value: 1550, itemStyle: { color: accent } },
          { value: 2800, itemStyle: { color: accent } },
          { value: 1550, itemStyle: { color: accent } },
          { value: 1150, itemStyle: { color: accent } }
        ],
        barWidth: '50%',
        itemStyle: {
          borderRadius: [6, 6, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          color: ink,
          fontSize: 11,
          fontFamily: 'DM Mono, monospace',
          formatter: function(params) {
            var v = params.value;
            if (v >= 1000) return (v / 1000).toFixed(1) + 's';
            return v + 'ms';
          }
        }
      }]
    });

    var animData = [
      { name: 'rise', duration: '0.24s', curve: 'ease-out', purpose: '底部弹窗上升' },
      { name: 'dialog-pop', duration: '0.22s', curve: 'cubic-bezier(.2,.8,.25,1)', purpose: '居中弹窗弹出' },
      { name: 'playhead', duration: '8.0s', curve: 'linear forwards', purpose: '播放器进度条' },
      { name: 'swipe-nudge', duration: '1.55s', curve: 'cubic-bezier(.36,.01,.22,1)', purpose: '首卡左右摆动引导' },
      { name: 'swipe-pulse', duration: '2.8s', curve: 'ease-in-out infinite', purpose: '滑动指令呼吸脉冲' },
      { name: 'swipe-overlay', duration: '1.55s', curve: 'ease', purpose: '滑动遮罩淡入淡出' },
      { name: 'swipe-arrow', duration: '1.15s', curve: 'ease-in-out infinite', purpose: '箭头左右位移' }
    ];

    window.addEventListener('resize', function() { animChart.resize(); });
  }

  // ========== Chart 2: Code Lines Distribution ==========
  var chartCode = document.getElementById('chart-codelines');
  if (chartCode && window.echarts) {
    var codeChart = echarts.init(chartCode, null, { renderer: 'svg' });
    codeChart.setOption({
      animation: false,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        formatter: function(params) {
          return '<b>' + params.name + '</b><br/>' +
                 '行数: ' + params.value + '<br/>' +
                 '占比: ' + params.percent + '%';
        }
      },
      legend: {
        bottom: 10,
        left: 'center',
        textStyle: { color: muted, fontSize: 12 },
        itemWidth: 14,
        itemHeight: 14,
        itemGap: 20
      },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: bg2,
          borderWidth: 3
        },
        label: {
          show: true,
          position: 'center',
          formatter: function() {
            return '{total|2,402}\n{label|总代码行数}';
          },
          rich: {
            total: {
              fontSize: 28,
              fontWeight: 600,
              color: ink,
              fontFamily: 'DM Mono, monospace',
              lineHeight: 36
            },
            label: {
              fontSize: 12,
              color: muted,
              lineHeight: 18
            }
          }
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 600
          }
        },
        data: [
          { value: 1543, name: 'index.css (样式系统)', itemStyle: { color: accent } },
          { value: 859, name: 'App.tsx (应用逻辑)', itemStyle: { color: accent2 } }
        ]
      }]
    });
    window.addEventListener('resize', function() { codeChart.resize(); });
  }

})();
