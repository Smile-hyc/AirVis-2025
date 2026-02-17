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

// 山峦图组件，用于展示各月份的数值分布概览，以及支持双击进入单月详情视图。
export class RidgelineChart {
    /**
     * @param {string|Object} container - D3 选择器
     * @param {Function} onDblClickCallback - 双击时的外部回调 (可选)
     */
    constructor(container, onDblClickCallback) {
        this.container = d3.select(container);
        this.onDblClick = onDblClickCallback;
        
        // 内部状态保存，用于子视图返回
        this.currentData = null;
        this.currentPollutant = null;
        this.currentNationalData = null;
        this.isDetailView = false;
    }

    // 根据污染物类型获取对应颜色
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

    //渲染图表入口
    render(data, pollutant = 'AQI', nationalData = null) {
        this.currentData = data;
        this.currentPollutant = pollutant;
        this.currentNationalData = nationalData;
        
        // 如果不在详情模式，则渲染山峦图
        if (!this.isDetailView) {
            this.renderRidgelineView(data, pollutant);
        }
    }

    //渲染山峦概览图
    renderRidgelineView(data, pollutant) {
        this.container.selectAll("*").remove();

        // 恢复标题 (如果父级有标题元素)
        d3.select(this.container.node().parentNode).select("h4").text("山峦图 (Ridgeline)");

        const dims = this.getDimensions();
        const margin = {top: 20, right: 10, bottom: 20, left: 30}; 
        const width = dims.width;
        const height = dims.height;
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const svg = this.container.append("svg").attr("width", width).attr("height", height);
        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        const xMax = d3.max(data, d => d.value) || 10;
        const x = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);

        const y = d3.scaleBand().domain(d3.range(12)).range([0, innerH]).paddingInner(0.2);

        g.append("g").attr("transform", `translate(0, ${innerH})`).call(d3.axisBottom(x).ticks(5));

        // KDE 密度计算
        const bandwidth = x.domain()[1] / 30;
        const kde = (kernel, X) => V => X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
        const epanechnikov = k => v => Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
        const density = kde(epanechnikov(bandwidth), x.ticks(40));

        d3.groups(data, d => d.date.getMonth()).forEach(([m, vals]) => {
            const dData = density(vals.map(d => d.value));
            const yBase = y(m) + y.bandwidth();
            
            // 调整重叠比例
            const overlapRatio = 0.9; 
            const yMount = d3.scaleLinear()
                .domain([0, d3.max(dData, d => d[1])])
                .range([0, -y.bandwidth() * overlapRatio]);

            const meanVal = d3.mean(vals, v => v.value);

            // 绘制山峦区域
            g.append("path").datum(dData)
                .attr("fill", this.getColor(meanVal, pollutant))
                .attr("opacity", 0.8)
                .attr("stroke", "white")
                .attr("transform", `translate(0, ${yBase})`)
                .attr("d", d3.area().curve(d3.curveBasis).x(d => x(d[0])).y0(0).y1(d => yMount(d[1])))
                .style("cursor", "pointer")
                .on("mouseover", (e) => {
                    d3.select(e.currentTarget).attr("opacity", 1).attr("stroke", "#333");
                    this.showTooltip(e, `<strong>${m+1}月</strong><br>月均值: ${meanVal.toFixed(1)}`);
                })
                .on("mouseout", (e) => {
                    d3.select(e.currentTarget).attr("opacity", 0.8).attr("stroke", "white");
                    this.hideTooltip();
                })
                .on("dblclick", () => { 
                    // 进入详情视图
                    if(this.onDblClick) this.onDblClick(m, this.currentNationalData); 
                    this.renderDetailView(m); 
                });
            
            g.append("text").attr("x", -5).attr("y", yBase).text((m+1)+"月").attr("text-anchor", "end").style("font-size", "10px").attr("fill", "#666");
        });
    }

    
     //渲染月份对比详情图 (柱状图 + 折线图)
     
    renderDetailView(monthIndex) {
        this.isDetailView = true;
        this.container.selectAll("*").remove();
        
        // 更新标题
        d3.select(this.container.node().parentNode).select("h4").text("柱状趋势图 (Bar Chart)");

        const dims = this.getDimensions();
        const margin = { top: 30, right: 20, bottom: 30, left: 40 };
        const width = dims.width;
        const height = dims.height;
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        // 数据过滤
        const monthCityData = this.currentData.filter(d => d.date.getMonth() === monthIndex);
        const validNationalData = (this.currentNationalData && Array.isArray(this.currentNationalData)) ? this.currentNationalData : [];
        const monthNationalData = validNationalData.filter(d => {
             const dt = d.date instanceof Date ? d.date : new Date(d.date);
             return dt.getMonth() === monthIndex;
        });

        const svg = this.container.append("svg").attr("width", width).attr("height", height);
        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        // 计算 Y 轴范围
        const maxCityVal = d3.max(monthCityData, d => d.value) || 0;
        const maxNationalVal = d3.max(monthNationalData, d => d.value) || 0;
        const yMax = Math.max(maxCityVal, maxNationalVal) * 1.1;

        const x = d3.scaleBand().domain(monthCityData.map(d => d.date.getDate())).range([0, innerW]).padding(0.3);
        const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

        // 标题
        g.append("text").attr("x", innerW/2).attr("y", -10).attr("text-anchor", "middle")
         .style("font-size", "12px").style("font-weight", "bold").style("fill", "#333")
         .text(`${monthIndex+1}月 每日趋势 (含全国均值)`);

        // 绘制城市数据柱状图
        g.selectAll(".bar").data(monthCityData).enter().append("rect")
            .attr("x", d => x(d.date.getDate()))
            .attr("y", d => y(d.value))
            .attr("width", x.bandwidth())
            .attr("height", d => innerH - y(d.value))
            .attr("fill", d => this.getColor(d.value, this.currentPollutant))
            .on("mouseover", (e, d) => {
                d3.select(e.currentTarget).attr("opacity", 0.8).attr("stroke", "#333");
                this.showTooltip(e, `<strong>${d.date.toLocaleDateString()}</strong><br>城市: ${d.value.toFixed(2)}`);
            })
            .on("mouseout", (e) => {
                d3.select(e.currentTarget).attr("opacity", 1).attr("stroke", "none");
                this.hideTooltip();
            });

        // 绘制全国均值折线
        if (monthNationalData.length > 0) {
            const line = d3.line()
                .x(d => {
                     const dt = d.date instanceof Date ? d.date : new Date(d.date);
                     return x(dt.getDate()) + x.bandwidth() / 2;
                })
                .y(d => y(d.value))
                .curve(d3.curveMonotoneX);

            g.append("path").datum(monthNationalData)
                .attr("fill", "none").attr("stroke", "black").attr("stroke-width", 2).attr("d", line);

            g.selectAll(".nat-dot").data(monthNationalData).enter().append("circle")
                .attr("cx", d => {
                     const dt = d.date instanceof Date ? d.date : new Date(d.date);
                     return x(dt.getDate()) + x.bandwidth() / 2;
                })
                .attr("cy", d => y(d.value))
                .attr("r", 2.5).attr("fill", "black")
                .on("mouseover", (e, d) => {
                    d3.select(e.currentTarget).attr("r", 5);
                    this.showTooltip(e, `<strong>全国均值</strong><br>${d.value.toFixed(2)}`);
                })
                .on("mouseout", (e) => {
                    d3.select(e.currentTarget).attr("r", 2.5);
                    this.hideTooltip();
                });
        }

        // 坐标轴
        g.append("g").attr("transform", `translate(0,${innerH})`)
         .call(d3.axisBottom(x).tickValues(x.domain().filter((d,i)=>!(i%3))).tickFormat(d=>d+"日"));
        g.append("g").call(d3.axisLeft(y).ticks(5));

        // 返回按钮
        const backBtn = svg.append("g").attr("transform", `translate(${width - 50}, 5)`).style("cursor", "pointer")
            .on("click", () => {
                this.isDetailView = false;
                this.renderRidgelineView(this.currentData, this.currentPollutant);
            });
        
        backBtn.append("rect").attr("width", 45).attr("height", 20).attr("rx", 4).attr("fill", "#eee").attr("stroke", "#ccc");
        backBtn.append("text").attr("x", 22.5).attr("y", 14).attr("text-anchor", "middle").style("font-size", "10px").text("返回");
    }
}