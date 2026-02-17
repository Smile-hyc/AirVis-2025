import * as d3 from 'd3';

/**
 * 绘制雷达图
 * @param {string} id - 容器 ID
 * @param {Array} data - 数据数组，格式 [[{axis: "AQI", value: 0.5}, ...], ...]
 * @param {Object} options - 配置项 {w, h, margin, color, seriesLabels}
 */
export function drawRadar(id, data, options) {
  const cfg = {
    w: 300, 
    h: 300,
    margin: {top: 30, right: 30, bottom: 30, left: 30},
    levels: 4, 
    maxValue: 0,
    // 默认颜色定义：[该地区(蓝), 全国均值(灰)]
    color: d3.scaleOrdinal().range(["#4a90e2", "#999999"]),
    seriesLabels: ["该地区", "全国"], 
    ...options
  };
  
  if (!data || data.length === 0 || !data[0]) return;

  // 动态计算最大值
  const maxValue = Math.max(cfg.maxValue, d3.max(data, i => d3.max(i.map(o => o.value))));
  const allAxis = (data[0].map(i => i.axis));
  const total = allAxis.length;
  
  // 计算半径 (0.85 为了给标签留出空间)
  const radius = Math.min(cfg.w / 2, cfg.h / 2) * 0.85;
  const angleSlice = Math.PI * 2 / total;
  const rScale = d3.scaleLinear().range([0, radius]).domain([0, maxValue]);

  // 清除旧图表
  d3.select(id).select("svg").remove();
  
  const svg = d3.select(id).append("svg")
    .attr("width", cfg.w + cfg.margin.left + cfg.margin.right)
    .attr("height", cfg.h + cfg.margin.top + cfg.margin.bottom);

  // 绘制右上角图例
  const legendX = cfg.w + cfg.margin.left + cfg.margin.right - 65;
  const legendY = 10; 

  const legendG = svg.append("g")
      .attr("class", "radar-legend")
      .attr("transform", `translate(${legendX}, ${legendY})`);

  // 蓝线图例 (该地区)
  legendG.append("line")
      .attr("x1", 0).attr("y1", 5).attr("x2", 15).attr("y2", 5)
      .attr("stroke", "#4a90e2").attr("stroke-width", 2);
  
  legendG.append("text")
      .attr("x", 20).attr("y", 8)
      .text("地区")
      .style("font-size", "10px")
      .style("fill", "#666")
      .style("font-family", "sans-serif");

  // 灰线图例 (全国)
  legendG.append("line")
      .attr("x1", 0).attr("y1", 20).attr("x2", 15).attr("y2", 20)
      .attr("stroke", "#999999").attr("stroke-width", 2);
  
  legendG.append("text")
      .attr("x", 20).attr("y", 23)
      .text("全国")
      .style("font-size", "10px")
      .style("fill", "#666")
      .style("font-family", "sans-serif");


  // 主绘图区
  const g = svg.append("g")
    .attr("transform", `translate(${cfg.w/2 + cfg.margin.left},${cfg.h/2 + cfg.margin.top})`);

  // 绘制网格圆圈
  const axisGrid = g.append("g").attr("class", "axisWrapper");
  
  axisGrid.selectAll(".levels")
     .data(d3.range(1, (cfg.levels+1)).reverse())
     .enter().append("circle")
     .attr("class", "gridCircle")
     .attr("r", d => radius/cfg.levels*d)
     .style("fill", "#CDCDCD")
     .style("stroke", "#CDCDCD")
     .style("fill-opacity", 0.1);

  // 绘制轴线和标签
  const axis = axisGrid.selectAll(".axis")
    .data(allAxis).enter().append("g").attr("class", "axis");

  axis.append("line")
    .attr("x1", 0).attr("y1", 0)
    .attr("x2", (d, i) => rScale(maxValue*1.1) * Math.cos(angleSlice*i - Math.PI/2))
    .attr("y2", (d, i) => rScale(maxValue*1.1) * Math.sin(angleSlice*i - Math.PI/2))
    .attr("class", "line")
    .style("stroke", "white")
    .style("stroke-width", "2px");

  axis.append("text")
    .attr("class", "legend")
    .style("font-size", "10px")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("x", (d, i) => rScale(maxValue * 1.2) * Math.cos(angleSlice*i - Math.PI/2))
    .attr("y", (d, i) => rScale(maxValue * 1.2) * Math.sin(angleSlice*i - Math.PI/2))
    .text(d => d)
    .style("fill", "#ccc")

  // 绘制雷达折线
  const radarLine = d3.lineRadial()
    .curve(d3.curveLinearClosed)
    .radius(d => rScale(d.value))
    .angle((d, i) => i * angleSlice);

  const wrapper = g.selectAll(".radarWrapper")
    .data(data).enter().append("g").attr("class", "radarWrapper");

  wrapper.append("path")
    .attr("class", "radarStroke")
    .attr("d", d => radarLine(d))
    .style("stroke-width", 2)
    .style("stroke", (d, i) => cfg.color(i))
    .style("fill", "none"); // 内部保持透明

  // 绘制数据点 + Tooltip 交互
  wrapper.each(function(seriesData, seriesIdx) {
      const circleGroup = d3.select(this);
      
      // 绘制数据点
      circleGroup.selectAll(".radarCircle")
        .data(seriesData).enter().append("circle")
        .attr("class", "radarCircle")
        .attr("r", 4)
        .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
        .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2))
        .style("fill", cfg.color(seriesIdx))
        .style("fill-opacity", 1)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).transition().duration(200).attr("r", 7);
            
            let tooltip = d3.select("body").select(".d3-tooltip");
            if (tooltip.empty()) {
                tooltip = d3.select("body").append("div").attr("class", "d3-tooltip");
            }
            
            // 显示提示框
            const seriesName = cfg.seriesLabels[seriesIdx] || `Data ${seriesIdx+1}`;

            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`
                <strong>${seriesName}</strong><br/>
                ${d.axis}: ${d.originalValue.toFixed(2)}
            `)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).transition().duration(200).attr("r", 4);
            d3.select("body").select(".d3-tooltip").transition().duration(200).style("opacity", 0);
        });
  });
}