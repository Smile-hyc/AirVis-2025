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

// 放射状时间图组件，用于展示某一污染物在全年或单月的时间分布情况
export class RadialChart {
    /**
     * @param {string|Object} container - D3 选择器或 DOM 元素
     */
    constructor(container) {
        this.container = d3.select(container);
        this.monthIndex = null; // 当前选中的月份索引 (null 表示显示全年)
    }

   //获取颜色比例尺
    getColor(value, pollutant) {
        const standard = POLLUTANT_STANDARDS[pollutant] || POLLUTANT_STANDARDS['AQI'];
        const scale = d3.scaleLinear().domain(standard.stops).range(standard.colors).clamp(true);
        return scale(value);
    }

   //显示提示框
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

 // 获取容器尺寸
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
     * 渲染图表入口
     * @param {Array} data - 数据数组
     * @param {string} pollutant - 污染物类型
     */
    render(data, pollutant = 'AQI') {
        this.container.selectAll("*").remove();

        const dims = this.getDimensions();
        const width = dims.width;
        const height = dims.height;

        if (!data || data.length === 0) return;
        
        const year = data[0].date.getFullYear();
        const maxValue = d3.max(data, d => d.value) || 300;
        
        // 计算半径
        const outerRadius = Math.min(width, height) / 2 - 5; 
        const innerRadius = 40;
        const centerX = width / 2;
        const centerY = height / 2;

        const svg = this.container.append("svg").attr("width", width).attr("height", height);
        const g = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);

        // 根据状态决定渲染年视图还是月视图
        if (this.monthIndex === null) {
            this.renderYearView(g, data, pollutant, year, maxValue, innerRadius, outerRadius);
        } else {
            this.renderMonthView(svg, g, data, pollutant, year, maxValue, innerRadius, outerRadius);
        }
    }

    // 渲染全年视图
    renderYearView(g, data, pollutant, year, maxValue, innerRadius, outerRadius) {
        const angleScale = d3.scaleTime()
            .domain([new Date(year, 0, 1), new Date(year, 11, 31)])
            .range([0, 2 * Math.PI]);
        
        const radiusScale = d3.scaleLinear()
            .domain([0, maxValue])
            .range([innerRadius, outerRadius]);

        // 绘制月份扇区背景 (作为点击区域)
        const arcGen = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(d => (d * 30) * (Math.PI / 180)) 
            .endAngle(d => ((d + 1) * 30) * (Math.PI / 180));

        const months = d3.range(0, 12);
        const sectorG = g.append("g").attr("class", "sectors");
        
        // 绘制月份扇区
        sectorG.selectAll("path")
            .data(months)
            .enter().append("path")
            .attr("d", arcGen)
            .attr("fill", "transparent")
            .attr("stroke", "#bbb")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4,2")
            .style("cursor", "pointer")
            .on("mouseover", function(e, d) { d3.select(this).attr("fill", "rgba(0,0,0,0.05)"); })
            .on("mouseout", function(e, d) { d3.select(this).attr("fill", "transparent"); })
            .on("click", (e, d) => {
                this.monthIndex = d; // 进入月视图
                this.render(data, pollutant); 
            })
            .append("title").text(d => `${d + 1}月 (点击查看详情)`);

        // 绘制月份标签
        const labelRadius = outerRadius - 12; 
        sectorG.selectAll("text.month-label")
            .data(months)
            .enter().append("text")
            .attr("class", "month-label")
            .attr("x", d => labelRadius * Math.sin(((d + 0.5) * 30) * Math.PI / 180)) 
            .attr("y", d => -labelRadius * Math.cos(((d + 0.5) * 30) * Math.PI / 180)) 
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .style("fill", "#999")
            .style("pointer-events", "none")
            .text(d => d + 1);

        // 绘制参考虚线圈
        const ticks = 3;
        for (let i = 1; i <= ticks; i++) {
            g.append("circle").attr("r", radiusScale((maxValue/ticks)*i))
               .attr("fill", "none").attr("stroke", "#ccc").attr("stroke-dasharray", "3,3").style("pointer-events", "none");
        }

        // 绘制数据散点
        g.selectAll(".aqi-dot")
            .data(data)
            .enter().append("circle")
            .attr("cx", d => radiusScale(d.value) * Math.cos(angleScale(d.date) - Math.PI / 2))
            .attr("cy", d => radiusScale(d.value) * Math.sin(angleScale(d.date) - Math.PI / 2))
            .attr("r", 2.5)
            .attr("fill", d => this.getColor(d.value, pollutant))
            .attr("opacity", 0.8)
            .style("pointer-events", "none");
        
        // 中心年份文字
        g.append("text").attr("y", 5).attr("text-anchor", "middle").style("font-weight","bold").style("fill", "#333").text(year);
    }

    // 渲染单月视图
    renderMonthView(svg, g, data, pollutant, year, maxValue, innerRadius, outerRadius) {
        const monthIndex = this.monthIndex;
        const monthData = data.filter(d => d.date.getMonth() === monthIndex);
        
        if (monthData.length === 0) {
            g.append("text").text("无数据").attr("text-anchor", "middle");
            this.renderBackButton(svg, data, pollutant);
            return;
        }

        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const angleScale = d3.scaleLinear().domain([1, daysInMonth + 1]).range([0, 2 * Math.PI]);
        const radiusScale = d3.scaleLinear().domain([0, maxValue]).range([innerRadius, outerRadius]);

        // 绘制日期放射线
        const days = d3.range(1, daysInMonth + 1);
        g.selectAll(".day-line").data(days).enter().append("line")
            .attr("x1", innerRadius * 0.8).attr("y1", 0)
            .attr("x2", outerRadius).attr("y2", 0)
            .attr("transform", d => `rotate(${(angleScale(d) * 180 / Math.PI) - 90})`)
            .attr("stroke", "#f0f0f0").attr("stroke-width", 1);

        // 参考圈
        for (let i = 1; i <= 3; i++) {
            g.append("circle").attr("r", radiusScale((maxValue/3)*i)).attr("fill", "none").attr("stroke", "#ccc").attr("stroke-dasharray", "3,3");
        }

        // 绘制单月数据点
        g.selectAll(".month-dot").data(monthData).enter().append("circle")
            .attr("cx", d => radiusScale(d.value) * Math.cos(angleScale(d.date.getDate()) - Math.PI / 2))
            .attr("cy", d => radiusScale(d.value) * Math.sin(angleScale(d.date.getDate()) - Math.PI / 2))
            .attr("r", 5)
            .attr("fill", d => this.getColor(d.value, pollutant))
            .attr("stroke", "#fff").attr("stroke-width", 1)
            .on("mouseover", (e, d) => {
                d3.select(e.currentTarget).attr("r", 8).attr("stroke", "#333");
                this.showTooltip(e, `<strong>${d.date.toLocaleDateString()}</strong><br>${pollutant}: ${d.value}`);
            })
            .on("mouseout", (e) => {
                d3.select(e.currentTarget).attr("r", 5).attr("stroke", "#fff");
                this.hideTooltip();
            });

        // 中心信息
        g.append("text").attr("y", 0).attr("text-anchor", "middle").style("font-size", "20px").style("font-weight","bold").style("fill", "#333").text(`${monthIndex + 1}月`);
        g.append("text").attr("y", 20).attr("text-anchor", "middle").style("font-size", "12px").style("fill", "#999").text("每日分布");
        
        this.renderBackButton(svg, data, pollutant);
    }

   //返回按钮
    renderBackButton(svg, data, pollutant) {
        const btnGroup = svg.append("g").attr("class", "btn-back").attr("transform", "translate(10, 10)").style("cursor", "pointer")
            .on("click", () => {
                this.monthIndex = null; // 返回全景
                this.render(data, pollutant);
            });
        btnGroup.append("rect").attr("width", 80).attr("height", 24).attr("rx", 4).attr("ry", 4).attr("fill", "#f0f0f0").attr("stroke", "#ccc");
        btnGroup.append("text").attr("x", 40).attr("y", 17).attr("text-anchor", "middle").style("font-size", "11px").style("fill", "#333").text("↩ 返回全景");
        btnGroup.on("mouseover", function() { d3.select(this).select("rect").attr("fill", "#e0e0e0"); }).on("mouseout", function() { d3.select(this).select("rect").attr("fill", "#f0f0f0"); });
    }
}