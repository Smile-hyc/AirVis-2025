import * as d3 from 'd3';
import { RadialChart } from './RadialChart.js';
import { RidgelineChart } from './RidgelineChart.js';
import { RaincloudChart } from './RaincloudChart.js';
import { CalendarChart } from './CalendarChart.js';
import { MiniRankChart } from './MiniRankChart.js';

// 污染物颜色标准 (仅用于生成图例)
const POLLUTANT_STANDARDS = {
    'AQI':   { stops: [0, 50, 100, 150, 200, 300], colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'PM2.5': { stops: [0, 35, 75, 115, 150, 250],  colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'PM10':  { stops: [0, 50, 150, 250, 350, 420], colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'CO':    { stops: [0, 2, 4, 14, 24, 36],       colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'NO2':   { stops: [0, 40, 80, 180, 280, 565],  colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'SO2':   { stops: [0, 10, 20, 40, 60, 100],    colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'O3':    { stops: [0, 100, 160, 215, 265, 800],colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] }
};


 //区域详细分析仪表盘
 //负责管理 "城市深度分析" 面板的布局和子图表渲染。
 
export class RegionalDashboard {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = d3.select(containerId);
        
        // 外部事件回调接口
        this.onMonthClick = null; 
        this.onRidgelineDblClick = null;
        
        // 子图表实例引用
        this.radialChart = null;
        this.ridgelineChart = null;
        this.raincloudChart = null;
        this.miniRankChart = null;
        this.calendarChart = null;
    }

 // 停止所有动画（如动态排名）
    stopAnimation() {
        if (this.miniRankChart) {
            this.miniRankChart.stopAnimation();
        }
    }

    //渲染顶部动态图例
    renderHeaderLegend(pollutant) {
        const header = d3.select(".detail-header");
        let legendContainer = header.select(".header-legend-container");
        if (legendContainer.empty()) {
            legendContainer = header.insert("div", "#btn-exit-drilldown")
                .attr("class", "header-legend-container");
        }
        legendContainer.html("");

        // 根据污染物类型获取对应颜色标准
        const standard = POLLUTANT_STANDARDS[pollutant] || POLLUTANT_STANDARDS['AQI'];
        const stops = standard.stops;
        const colors = standard.colors;

        colors.forEach((color, i) => {
            if (i >= stops.length) return;
            const start = stops[i];
            const end = stops[i+1]; 
            const labelText = (end !== undefined) ? `${start}-${end}` : `>${start}`;
            const item = legendContainer.append("div").attr("class", "legend-item");
            item.append("span").attr("class", "color-box").style("background", color);
            item.append("span").text(labelText);
        });
    }

    /**
     * 渲染主仪表盘 (包含4个格子的视图)
     * @param {Array} data - 城市数据
     * @param {string} pollutant - 污染物
     * @param {Array} nationalData - 全国对比数据
     */
    renderDashboard(data, pollutant, nationalData = null) {
        this.stopAnimation();
        this.container.html("");
        
        this.renderHeaderLegend(pollutant);
        
        // 定义4个图表的布局配置
        const chartConfigs = [
            { id: 'cell-radial', title: '星云图 (Radial)', type: 'radial' },
            { id: 'cell-ridgeline', title: '山峦图 (Ridgeline)', type: 'ridgeline' },
            { id: 'cell-raincloud', title: '雨云图 (Raincloud)', type: 'raincloud' },
            { id: 'cell-dynamic', title: '区域排名动态 (Dynamic Ranking)', type: 'dynamic' }
        ];

        // 动态创建网格 Cell
        chartConfigs.forEach(chart => {
            const cell = this.container.append("div").attr("class", "chart-cell");
            
            cell.append("h4").text(chart.title)
                .style("margin", "0 0 5px 0") 
                .style("text-align", "center")
                .style("font-size", "14px")
                .style("color", "#666");
            
            cell.append("div").attr("id", chart.id)
                .style("height", "calc(100% - 25px)") 
                .style("width", "100%")
                .style("position", "relative");
        });

        // 渲染星云图
        this.radialChart = new RadialChart("#cell-radial");
        this.radialChart.render(data, pollutant);
    
        // 渲染山峦图
        this.ridgelineChart = new RidgelineChart("#cell-ridgeline", (monthIndex, natData) => {
            if (this.onRidgelineDblClick) this.onRidgelineDblClick(monthIndex, natData);
        });
        this.ridgelineChart.render(data, pollutant, nationalData);

        // 渲染雨云图
        this.raincloudChart = new RaincloudChart("#cell-raincloud");
        this.raincloudChart.render(data, pollutant, nationalData);

        // 动态排名图 (需在外部调用 renderDynamicRanking 传入 region)
        // 这里只是预留了 #cell-dynamic，具体渲染由 main.js 调用下面的 renderDynamicRanking 方法
    }

  //渲染动态区域排名
    renderDynamicRanking(containerId, region, pollutant) {
        this.miniRankChart = new MiniRankChart(containerId);
        this.miniRankChart.render(region, pollutant);
    }

    //渲染侧边栏日历
    renderCalendar(data, pollutant, containerSelector) {
        this.calendarChart = new CalendarChart(containerSelector);
        this.calendarChart.render(data, pollutant, containerSelector);
    }

    // 渲染单月详情视图 (钻取模式) - 这里保留给 Ridgeline 的双击或者其他需要全屏的情况
    renderMonthDetail(monthIndex, allData, nationalData, pollutant) {
        this.stopAnimation();
        this.container.html(""); // 清空网格

        this.renderHeaderLegend(pollutant);
        
        const dims = { width: this.container.node().clientWidth, height: this.container.node().clientHeight };
        const margin = { top: 40, right: 30, bottom: 60, left: 60 };
        const width = dims.width - margin.left - margin.right;
        const height = dims.height - margin.top - margin.bottom;

        const svg = this.container.append("svg").attr("width", dims.width).attr("height", dims.height);
        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        const monthData = allData.filter(d => d.date.getMonth() === monthIndex);
        
        const x = d3.scaleBand().domain(monthData.map(d=>d.date.getDate())).range([0, width]).padding(0.3);
        const y = d3.scaleLinear().domain([0, d3.max(monthData, d=>d.value)]).range([height, 0]);
        
        const standard = POLLUTANT_STANDARDS[pollutant] || POLLUTANT_STANDARDS['AQI'];
        const colorScale = d3.scaleLinear().domain(standard.stops).range(standard.colors).clamp(true);

        g.selectAll(".bar").data(monthData).enter().append("rect")
            .attr("x", d=>x(d.date.getDate())).attr("y", d=>y(d.value))
            .attr("width", x.bandwidth()).attr("height", d=>height - y(d.value))
            .attr("fill", d=>colorScale(d.value))
            .append("title").text(d => `${d.date.toLocaleDateString()}: ${d.value}`);

        g.append("g").attr("transform", `translate(0,${height})`)
         .call(d3.axisBottom(x).tickFormat(d=>d+"日"));
        
        g.append("g").call(d3.axisLeft(y));
        
        g.append("text").attr("x", width/2).attr("y", -10).attr("text-anchor", "middle")
         .style("font-size", "18px").text(`${monthIndex+1}月 ${pollutant} 每日详情`);
    }

    // 在已有 Ridgeline 图表中更新单月详情视图数据
    renderRidgelineCellDetail(monthIndex, nationalData) {
        if (this.ridgelineChart) {
            this.ridgelineChart.currentNationalData = nationalData;
            this.ridgelineChart.renderDetailView(monthIndex);
        }
    }
}