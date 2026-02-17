import * as d3 from 'd3';

// 动态渐变色图例，适用于侧边栏宽度较窄的场景
export class Legend {
  /**
   * @param {string} containerId
   */
  constructor(containerId) {
    this.containerId = containerId;
    this.svg = null;
    this.width = 280; // 适配侧边栏宽度
    this.height = 50;
    this.textG = null;
    
    this.init();
  }

  init() {
    // 创建 SVG 容器
    this.svg = d3.select(this.containerId).append("svg")
      .attr("width", this.width)
      .attr("height", this.height);

    // 定义渐变色
    const defs = this.svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "legend-gradient-dynamic")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%"); 

    // 使用 interpolateRdYlBu 的反转色 (蓝 -> 黄 -> 红)
    const stops = d3.range(0, 1.1, 0.1);
    gradient.selectAll("stop")
      .data(stops)
      .enter().append("stop")
      .attr("offset", d => `${d * 100}%`)
      .attr("stop-color", d => d3.interpolateRdYlBu(1 - d)); 

    // 绘制矩形色带
    this.svg.append("rect")
      .attr("x", 10).attr("y", 5)
      .attr("width", this.width - 20)
      .attr("height", 12)
      .style("fill", "url(#legend-gradient-dynamic)")
      .style("rx", 6)
      .style("stroke", "rgba(0,0,0,0.1)");
      
    this.textG = this.svg.append("g").attr("class", "legend-labels");
  }

  /**
   * 更新图例的数值范围和单位
   * @param {string} pollutant - 污染物类型 (AQI, PM2.5 等)
   */
  update(pollutant) {
    if (!this.textG) return;
    
    // 指标上限配置 (与 MapChart 热力图逻辑保持一致)
    let maxVal = 150;
    let unit = ""; // AQI 无单位
    
    if (pollutant === 'AQI') { maxVal = 200; }
    if (pollutant === 'PM2.5') { maxVal = 150; unit = "μg/m³"; }
    if (pollutant === 'PM10') { maxVal = 150; unit = "μg/m³"; }
    if (pollutant === 'CO') { maxVal = 2; unit = "mg/m³"; }
    if (pollutant === 'SO2') { maxVal = 80; unit = "μg/m³"; }
    if (pollutant === 'NO2') { maxVal = 80; unit = "μg/m³"; }
    if (pollutant === 'O3') { maxVal = 160; unit = "μg/m³"; }

    const values = [0, maxVal / 2, maxVal];
    
    // 线性比例尺：数值 -> x坐标
    const scale = d3.scaleLinear()
      .domain([0, maxVal])
      .range([10, this.width - 10]); 

    // 渲染数值标签
    const texts = this.textG.selectAll("text.val").data(values);
    texts.exit().remove();

    texts.enter().append("text")
      .attr("class", "val")
      .merge(texts)
      .attr("x", d => scale(d))
      .attr("y", 32) 
      .attr("text-anchor", (d, i) => {
          if (i === 0) return "start"; // 0 左对齐
          if (i === 2) return "end";   // 最大值右对齐
          return "middle";             // 中间值居中
      })
      .style("font-size", "11px")
      .style("fill", "#666")
      .style("font-weight", "600")
      .style("font-family", "sans-serif")
      .text(d => Math.round(d));
      
    // 渲染标题和单位
    this.svg.selectAll(".legend-unit").remove();
    this.svg.append("text")
        .attr("class", "legend-unit")
        .attr("x", this.width / 2)
        .attr("y", 46)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#999")
        .text(`${pollutant} ${unit}`);
  }
}