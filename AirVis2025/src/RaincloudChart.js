import * as d3 from 'd3';

// 污染物颜色标准定义
const POLLUTANT_STANDARDS = {
    'AQI':   { stops: [0, 50, 100, 150, 200, 300], colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'PM2.5': { stops: [0, 35, 75, 115, 150, 250],  colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'PM10':  { stops: [0, 50, 150, 250, 350, 420], colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'CO':    { stops: [0, 2, 4, 14, 24, 36],       colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'NO2':   { stops: [0, 40, 80, 180, 280, 565],  colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'SO2':   { stops: [0, 10, 20, 40, 60, 100],    colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'O3':    { stops: [0, 100, 160, 215, 265, 800],colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] }
};


 //雨云图组件 (Raincloud Chart)
 //结合了密度图(云)、数据散点(雨)和箱线统计，用于展示数据分布详情。
 //支持鼠标滚轮缩放 Y 轴以查看细节。

export class RaincloudChart {
    /**
     * @param {string|Object} container - D3 选择器
     */
    constructor(container) {
        this.container = d3.select(container);
    }

    getColor(value, pollutant) {
        const standard = POLLUTANT_STANDARDS[pollutant] || POLLUTANT_STANDARDS['AQI'];
        const scale = d3.scaleLinear().domain(standard.stops).range(standard.colors).clamp(true);
        return scale(value);
    }

    // 显示提示框
    showTooltip(event, htmlContent) {
        let tooltip = d3.select("body").select(".d3-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body").append("div")
                .attr("class", "d3-tooltip")
                .style("opacity", 0)
                .style("position", "absolute")
                .style("z-index", "99999")
                .style("pointer-events", "none")
                .style("background", "rgba(0,0,0,0.8)")
                .style("color", "#fff")
                .style("padding", "8px")
                .style("border-radius", "4px")
                .style("font-size", "12px");
        }
        tooltip.transition().duration(100).style("opacity", 0.9);
        tooltip.html(htmlContent)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
    }

    // 隐藏提示框
    hideTooltip() {
        d3.select("body").select(".d3-tooltip").transition().duration(200).style("opacity", 0);
    }

    getDimensions() {
        const node = this.container.node();
        if (node) {
            const rect = node.getBoundingClientRect();
            return {
                width: rect.width || 300,
                height: Math.max(rect.height, 200) || 300
            };
        }
        return { width: 300, height: 300 };
    }

    /**
     * 渲染图表
     * @param {Array} data - 城市每日数据
     * @param {string} pollutant - 污染物类型
     * @param {Array} nationalData - 全国每日均值数据 (可选)
     */
    render(data, pollutant = 'AQI', nationalData = null) {
        this.container.selectAll("*").remove();

        const dims = this.getDimensions();
        const margin = {top: 25, right: 10, bottom: 20, left: 30}; 
        const width = dims.width;
        const height = dims.height;
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        // 创建 SVG 并定义裁剪区域
        const svg = this.container.append("svg").attr("width", width).attr("height", height);
        
        // 定义 ClipPath 确保缩放内容不溢出
        svg.append("defs").append("clipPath")
           .attr("id", "raincloud-clip")
           .append("rect")
           .attr("width", innerW)
           .attr("height", innerH);

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        // 数据预处理
        const months = d3.groups(data, d => d.date.getMonth());
        const monthMeanData = [];
        
        const x = d3.scaleBand().range([0, innerW]).domain(d3.range(12)).padding(0.1);
        
        // 计算 Y 轴最大值 (包含全国数据)
        const maxVal = d3.max(data, d=>d.value);
        let maxValWithNat = maxVal;
        let validNatData = [];
        
        if (nationalData && Array.isArray(nationalData) && nationalData.length > 0) {
            validNatData = nationalData.filter(d => d && d.date && typeof d.date.getMonth === 'function');
            if (validNatData.length > 0) {
                const natMax = d3.max(validNatData, d => d.value);
                maxValWithNat = Math.max(maxVal, natMax);
            }
        }

        const y = d3.scaleLinear().domain([0, maxValWithNat * 1.1]).range([innerH, 0]);
        
        // 绘制坐标轴
        const xAxisG = g.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${innerH})`)
            .call(d3.axisBottom(x).tickFormat(d => d + 1 + "月"));
        xAxisG.select(".domain").attr("stroke", "#ddd");

        const yAxisG = g.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(y).ticks(5));
        yAxisG.select(".domain").attr("stroke", "#ddd");

        // 创建主要内容容器，并应用 ClipPath
        const contentG = g.append("g").attr("clip-path", "url(#raincloud-clip)");

        // KDE 密度估算配置
        const bandwidth = maxVal / 40; 
        const kernelDensityEstimator = (kernel, X) => V => X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
        const kernelEpanechnikov = k => v => Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
        const kde = kernelDensityEstimator(kernelEpanechnikov(bandwidth), y.ticks(100));

        // 绘制区域（本地）数据分布 (云 + 雨) 
        months.forEach(([monthIndex, values]) => {
            const rawValues = values.map(d => d.value);
            const meanVal = d3.mean(rawValues);
            monthMeanData.push({ monthIndex: monthIndex, value: meanVal });

            const density = kde(rawValues);
            const maxDensity = d3.max(density, d => d[1]);
            const densityScale = d3.scaleLinear().domain([0, maxDensity]).range([0, x.bandwidth() / 2]);

            // 云朵 (密度图) 生成器
            const areaGenerator = d3.area()
                .y(d => y(d[0]))
                .x0(d => x(monthIndex) + x.bandwidth()/2 - densityScale(d[1]))
                .x1(d => x(monthIndex) + x.bandwidth()/2 + densityScale(d[1]))
                .curve(d3.curveBasis); 

            contentG.append("path")
                .datum(density)
                .attr("class", "cloud-path") // 标记以便缩放更新
                .attr("data-month", monthIndex) // 绑定月份索引
                .attr("fill", "lightgray")
                .attr("stroke", "none")
                .attr("opacity", 0.5)
                .attr("d", areaGenerator)
                .on("mouseover", (e, d) => {
                    d3.select(e.currentTarget).attr("opacity", 0.8).attr("stroke", "#999");
                    this.showTooltip(e, `<strong>${monthIndex+1}月分布</strong><br>月均值: ${meanVal.toFixed(2)}`);
                })
                .on("mouseout", (e) => {
                    d3.select(e.currentTarget).attr("opacity", 0.5).attr("stroke", "none");
                    this.hideTooltip();
                });

            // 雨点 (散点)
            contentG.selectAll(`.rain-${monthIndex}`)
                .data(values).enter().append("circle")
                .attr("class", "rain-dot") 
                .attr("cy", d => y(d.value))
                .attr("cx", d => {
                    // 暂存原始CX以便缩放时使用 (保持抖动一致性)
                    if (!d.jitterX) {
                        const center = x(monthIndex) + x.bandwidth() / 2;
                        const jitter = (Math.random() - 0.5) * (x.bandwidth() * 0.4); 
                        d.jitterX = center + jitter;
                    }
                    return d.jitterX;
                })
                .attr("r", 2.5)
                .attr("fill", d => this.getColor(d.value, pollutant))
                .attr("opacity", 0.7)
                .on("mouseover", (e, d) => {
                    d3.select(e.currentTarget).attr("r", 5).attr("stroke", "#333").attr("opacity", 1);
                    this.showTooltip(e, `<strong>${d.date.toLocaleDateString()}</strong><br>${pollutant}: ${d.value}`);
                })
                .on("mouseout", (e) => {
                    d3.select(e.currentTarget).attr("r", 2.5).attr("stroke", "none").attr("opacity", 0.7);
                    this.hideTooltip();
                });
        });

        // 均值线生成器
        const lineGenerator = d3.line()
            .x(d => x(d.monthIndex) + x.bandwidth() / 2) 
            .y(d => y(d.value))
            .curve(d3.curveMonotoneX); 

        //绘制区域均值线 (橙红色)
        monthMeanData.sort((a, b) => a.monthIndex - b.monthIndex);
        
        contentG.append("path").datum(monthMeanData)
            .attr("class", "mean-line local-mean-line") 
            .attr("fill", "none")
            .attr("stroke", "#FF5722") 
            .attr("stroke-width", 2.5)
            .attr("d", lineGenerator)
            .style("pointer-events", "none");

        // 均值点
        contentG.selectAll(".local-mean-dot")
            .data(monthMeanData)
            .enter().append("circle")
            .attr("class", "local-mean-dot")
            .attr("cx", d => x(d.monthIndex) + x.bandwidth() / 2)
            .attr("cy", d => y(d.value))
            .attr("r", 4) 
            .attr("fill", "#FF5722") 
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseover", (e, d) => {
                d3.select(e.currentTarget).attr("r", 6).attr("stroke", "#333");
                this.showTooltip(e, `<strong>区域均值 (${d.monthIndex + 1}月)</strong><br>数值: ${d.value.toFixed(2)}`);
            })
            .on("mouseout", (e) => {
                d3.select(e.currentTarget).attr("r", 4).attr("stroke", "#fff");
                this.hideTooltip();
            });

        // 绘制全国均值线 (灰色虚线) 
        let natMonthMeans = [];
        if (validNatData.length > 0) {
            const natMonths = d3.groups(validNatData, d => d.date.getMonth());
            natMonthMeans = natMonths.map(([m, vals]) => ({
                monthIndex: m,
                value: d3.mean(vals, d => d.value)
            })).sort((a, b) => a.monthIndex - b.monthIndex);

            contentG.append("path").datum(natMonthMeans)
                .attr("class", "mean-line nat-mean-line")
                .attr("fill", "none")
                .attr("stroke", "#555") 
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5") 
                .attr("d", lineGenerator)
                .attr("opacity", 0.9);

            // 全国均值点
            contentG.selectAll(".nat-mean-dot")
                .data(natMonthMeans)
                .enter().append("circle")
                .attr("class", "nat-mean-dot")
                .attr("cx", d => x(d.monthIndex) + x.bandwidth() / 2)
                .attr("cy", d => y(d.value))
                .attr("r", 4) 
                .attr("fill", "#555") 
                .attr("stroke", "#fff")
                .attr("stroke-width", 2)
                .style("cursor", "pointer")
                .on("mouseover", (e, d) => {
                    d3.select(e.currentTarget).attr("r", 6).attr("stroke", "#333");
                    this.showTooltip(e, `<strong>全国均值 (${d.monthIndex + 1}月)</strong><br>数值: ${d.value.toFixed(2)}`);
                })
                .on("mouseout", (e) => {
                    d3.select(e.currentTarget).attr("r", 4).attr("stroke", "#fff");
                    this.hideTooltip();
                });
        }

        //添加图例 (Top Right)
        const legendG = svg.append("g")
            .attr("transform", `translate(${width - 100}, 5)`);
        
        // 该地区图例
        const localLegend = legendG.append("g").attr("transform", "translate(0, 0)");
        localLegend.append("line")
            .attr("x1", 0).attr("y1", 0).attr("x2", 20).attr("y2", 0)
            .attr("stroke", "#FF5722").attr("stroke-width", 2.5);
        localLegend.append("circle")
            .attr("cx", 10).attr("cy", 0).attr("r", 3)
            .attr("fill", "#FF5722");
        localLegend.append("text")
            .attr("x", 25).attr("y", 3)
            .text("该地区均值")
            .style("font-size", "10px").style("fill", "#666");

        // 全国图例
        const natLegend = legendG.append("g").attr("transform", "translate(0, 15)");
        natLegend.append("line")
            .attr("x1", 0).attr("y1", 0).attr("x2", 20).attr("y2", 0)
            .attr("stroke", "#555").attr("stroke-width", 2).attr("stroke-dasharray", "5,5");
        natLegend.append("circle")
            .attr("cx", 10).attr("cy", 0).attr("r", 3)
            .attr("fill", "#555");
        natLegend.append("text")
            .attr("x", 25).attr("y", 3)
            .text("全国均值")
            .style("font-size", "10px").style("fill", "#666");

        // 缩放交互逻辑
        const zoom = d3.zoom()
            .scaleExtent([1, 50]) 
            .translateExtent([[0, 0], [innerW, innerH]]) // 限制拖拽范围
            .extent([[0, 0], [innerW, innerH]])
            .on("zoom", (event) => {
                // 仅缩放 Y 轴，X 轴保持不变
                const newY = event.transform.rescaleY(y);

                // 更新 Y 轴
                yAxisG.call(d3.axisLeft(newY).ticks(5));
                yAxisG.select(".domain").attr("stroke", "#ddd");

                // 更新云朵 (使用新的 Y 比例尺重新生成区域路径)
                contentG.selectAll(".cloud-path").attr("d", function(d) {
                    const mIdx = +d3.select(this).attr("data-month");
                    const maxD = d3.max(d, p => p[1]);
                    const dScale = d3.scaleLinear().domain([0, maxD]).range([0, x.bandwidth() / 2]);
                    
                    return d3.area()
                        .y(p => newY(p[0]))
                        .x0(p => x(mIdx) + x.bandwidth()/2 - dScale(p[1]))
                        .x1(p => x(mIdx) + x.bandwidth()/2 + dScale(p[1]))
                        .curve(d3.curveBasis)(d);
                });

                // 更新雨点位置
                contentG.selectAll(".rain-dot")
                    .attr("cy", d => newY(d.value));

                // 更新均值线
                const newLine = d3.line()
                    .x(d => x(d.monthIndex) + x.bandwidth() / 2)
                    .y(d => newY(d.value))
                    .curve(d3.curveMonotoneX);
                
                contentG.selectAll(".mean-line").attr("d", newLine);

                // 更新均值点
                contentG.selectAll(".local-mean-dot, .nat-mean-dot")
                    .attr("cy", d => newY(d.value));
            });
            
        // 绑定 Zoom，禁用双击缩放以免与系统级双击冲突
        svg.call(zoom).on("dblclick.zoom", null);
    }
}