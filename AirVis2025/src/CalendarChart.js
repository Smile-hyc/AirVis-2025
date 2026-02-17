import * as d3 from 'd3';

// 污染物颜色标准定义，用于日历图和其他图表的配色
const POLLUTANT_STANDARDS = {
    'AQI':   { stops: [0, 50, 100, 150, 200, 300], colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'PM2.5': { stops: [0, 35, 75, 115, 150, 250],  colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'PM10':  { stops: [0, 50, 150, 250, 350, 420], colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'CO':    { stops: [0, 2, 4, 14, 24, 36],       colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'NO2':   { stops: [0, 40, 80, 180, 280, 565],  colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'SO2':   { stops: [0, 10, 20, 40, 60, 100],    colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'O3':    { stops: [0, 100, 160, 215, 265, 800],colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] }
};


//日历热力图组件
//用于在侧边栏或主视图中展示全年的日历热力分布。
export class CalendarChart {
    /**
     * @param {string|Object} container - 默认容器
     */
    constructor(container) {
        if (container) {
            this.container = d3.select(container);
        }
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

    // 隐藏提示框
    hideTooltip() {
        d3.select("body").select(".d3-tooltip").transition().duration(200).style("opacity", 0);
    }

    // 渲染日历图
    // @param {Array} data - 数据数组
    // @param {string} pollutant - 污染物类型
    // @param {string} containerSelector - 指定渲染容器选择器 (覆盖构造函数中的)
    render(data, pollutant = 'AQI', containerSelector) {
        // 确定目标容器
        let target = containerSelector ? d3.select(containerSelector).select("#calendar-content") : this.container;
        // 兼容处理：如果容器内没有 #calendar-content，尝试直接渲染在容器内
        if(containerSelector && target.empty()) {
             target = d3.select(containerSelector);
        }
        
        target.selectAll("*").remove();

        const node = target.node();
        if (!node) return;
        
        // 动态计算尺寸
        const width = node.getBoundingClientRect().width || 300;
        const isNarrow = width < 500; // 窄屏模式 (如侧边栏)
        
        // 布局配置
        const monthsPerRow = isNarrow ? 2 : 6; 
        const padding = isNarrow ? 20 : 20; 
        const gap = isNarrow ? 10 : 10;
        
        // 计算单个月份块的宽度
        const availableWidth = width - padding - (monthsPerRow - 1) * gap;
        const monthWidth = availableWidth / monthsPerRow;
        const cellSize = (monthWidth / 7) * 0.6; // 格子大小
        
        const monthsData = d3.groups(data, d => d.date.getMonth());
        
        // 计算 SVG 总高度
        const rowsNeeded = Math.ceil(monthsData.length / monthsPerRow);
        const monthBlockHeight = (cellSize * 7) + 15; // 7行格子 + 标题
        const svgHeight = rowsNeeded * monthBlockHeight + 20; 
        
        const svg = target.append("svg").attr("width", width).attr("height", svgHeight); 
        let currentY = 10;
        
        // 绘制每个月份
        monthsData.forEach(([monthIndex, days]) => {
            const col = monthIndex % monthsPerRow;
            const row = Math.floor(monthIndex / monthsPerRow);
            
            const contentWidth = cellSize * 7;
            const centerOffset = (monthWidth - contentWidth) / 2;
            
            const xPos = (padding / 2) + col * (monthWidth + gap) + centerOffset;
            const yPos = currentY + row * monthBlockHeight;
            
            const g = svg.append("g").attr("transform", `translate(${xPos}, ${yPos})`);
            
            // 月份标题
            g.append("text").attr("x", 0).attr("y", -3)
             .text(`${monthIndex+1}月`)
             .style("font-size", "10px").style("font-weight", "bold").style("fill", "#666");
                
            // 绘制每日格子
            days.forEach(d => {
                const firstDay = new Date(d.date.getFullYear(), monthIndex, 1);
                const offset = firstDay.getDay(); // 0 是周日
                const dateNum = d.date.getDate();
                const gridIndex = dateNum + offset - 1;
                
                const dayCol = gridIndex % 7;
                const dayRow = Math.floor(gridIndex / 7);
                
                g.append("rect")
                    .attr("width", cellSize - 1).attr("height", cellSize - 1)
                    .attr("x", dayCol * cellSize).attr("y", dayRow * cellSize)
                    .attr("fill", this.getColor(d.value, pollutant))
                    .attr("rx", 1.5)
                    .on("mouseover", (e) => {
                        d3.select(e.currentTarget).attr("stroke", "#333").attr("stroke-width", 1);
                        this.showTooltip(e, `<strong>${d.date.toLocaleDateString()}</strong><br>${pollutant}: ${d.value}`);
                    })
                    .on("mouseout", (e) => {
                        d3.select(e.currentTarget).attr("stroke", "none");
                        this.hideTooltip();
                    });
            });
        });
    }
}