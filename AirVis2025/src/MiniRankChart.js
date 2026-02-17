import * as d3 from 'd3';

// 污染物颜色标准
const POLLUTANT_STANDARDS = {
    'AQI':   { stops: [0, 50, 100, 150, 200, 300], colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'PM2.5': { stops: [0, 35, 75, 115, 150, 250],  colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'PM10':  { stops: [0, 50, 150, 250, 350, 420], colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'CO':    { stops: [0, 2, 4, 14, 24, 36],       colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'NO2':   { stops: [0, 40, 80, 180, 280, 565],  colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'SO2':   { stops: [0, 10, 20, 40, 60, 100],    colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] },
    'O3':    { stops: [0, 100, 160, 215, 265, 800],colors: ['#00E400', '#FFFF00', '#FF7E00', '#FF0000', '#99004C', '#7E0023'] }
};

/**
 * 迷你动态排名图组件
 * 用于 Dashboard 右下角的区域排名轮播
 */
export class MiniRankChart {
    constructor(containerSelector) {
        this.containerSelector = containerSelector;
        this.animationTimer = null;
        this.isPlaying = false;
        this.animationSpeed = 2000;
    }

    // 根据污染物类型获取对应颜色
    getColor(value, pollutant) {
        const standard = POLLUTANT_STANDARDS[pollutant] || POLLUTANT_STANDARDS['AQI'];
        const scale = d3.scaleLinear().domain(standard.stops).range(standard.colors).clamp(true);
        return scale(value);
    }

    // 获取容器尺寸
    getDimensions(target) {
        const node = target.node();
        if (node) {
            const rect = node.getBoundingClientRect();
            return {
                width: rect.width || 300,
                height: Math.max(rect.height, 200) || 200
            };
        }
        return { width: 300, height: 200 };
    }

    // 停止动画
    stopAnimation() {
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
            this.animationTimer = null;
        }
        this.isPlaying = false;
        const btn = d3.select(this.containerSelector).select(".play-btn");
        if(!btn.empty()) btn.html('▶ 播放');
    }

    /**
     * 渲染图表
     * @param {string} region - 区域名称 (如 "华北")
     * @param {string} pollutant - 污染物类型
     */
    render(region, pollutant = 'AQI') {
        this.stopAnimation(); 
        
        const target = d3.select(this.containerSelector);
        target.selectAll("*").remove();
        
        //创建迷你控制栏 (播放按钮 + 速度选择)
        const controlsDiv = target.append("div")
            .attr("class", "mini-controls")
            .style("position", "absolute")
            .style("top", "5px").style("right", "10px").style("z-index", "10")
            .style("display", "flex").style("gap", "8px")
            .style("background", "rgba(255,255,255,0.8)").style("padding", "2px 5px").style("border-radius", "4px");
            
        const playBtn = controlsDiv.append("button")
            .attr("class", "play-btn")
            .style("border", "none").style("background", "none").style("cursor", "pointer")
            .style("font-size", "12px").style("color", "#4a90e2").style("font-weight", "bold").html('▶ 播放');
            
        const speedSelect = controlsDiv.append("select")
            .style("font-size", "10px").style("border", "1px solid #ccc").style("border-radius", "4px");
        speedSelect.append("option").text("慢").attr("value", 3000);
        speedSelect.append("option").text("中").attr("value", 2000).attr("selected", true);
        speedSelect.append("option").text("快").attr("value", 1000);
        
        //初始化 SVG
        const dims = this.getDimensions(target);
        const margin = { top: 35, right: 30, bottom: 20, left: 60 };
        const width = dims.width - margin.left - margin.right;
        const height = dims.height - margin.top - margin.bottom;

        const svg = target.append("svg").attr("width", dims.width).attr("height", dims.height)
            .append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
            
        const titleText = svg.append("text").attr("class", "chart-title")
            .attr("x", width).attr("y", -10).attr("text-anchor", "end")
            .style("font-size", "10px").style("fill", "#999").text(`加载 ${region} 数据...`);

        //加载数据
        d3.csv(`./data/${pollutant}_monthmean_${region}.csv`).then(csvData => {
            if (!csvData || csvData.length === 0) {
                titleText.text(`${region} 数据暂缺`);
                return;
            }
            
            //数据预处理
            const allMonths = [];
            const chartData = {};
            
            csvData.forEach(row => {
                const month = row.month;
                if (!month) return;
                allMonths.push(month);
                
                const cityData = [];
                for (const [city, val] of Object.entries(row)) {
                    if (city !== 'month' && val !== '' && val !== undefined) {
                        const value = parseFloat(val);
                        if (!isNaN(value)) cityData.push({ city: city, value: value });
                    }
                }
                // 默认按数值升序 (AQI越低越好)
                cityData.sort((a, b) => a.value - b.value);
                cityData.forEach((d, i) => d.rank = i + 1);
                chartData[month] = cityData.slice(0, 10); // 取前10名
            });

            let currentMonthIndex = 0;
            
            // 定义渲染单帧函数
            const renderFrame = () => {
                const monthStr = allMonths[currentMonthIndex];
                const currentData = chartData[monthStr];
                if(!currentData) return;

                titleText.text(`${region} ${pollutant}排名 ${monthStr}`);

                const yScale = d3.scaleBand().domain(currentData.map(d => d.city)).range([0, height]).padding(0.2);
                const maxValue = d3.max(currentData, d => d.value);
                const xScale = d3.scaleLinear().domain([0, maxValue * 1.1]).range([0, width]);
                    
                let xAxisGroup = svg.select('.x-axis');
                if (xAxisGroup.empty()) xAxisGroup = svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0, ${height})`);
                let yAxisGroup = svg.select('.y-axis');
                if (yAxisGroup.empty()) yAxisGroup = svg.append('g').attr('class', 'y-axis');
                
                // 坐标轴动画
                const t = d3.transition().duration(this.animationSpeed * 0.8).ease(d3.easeLinear);
                
                xAxisGroup.transition(t).call(d3.axisBottom(xScale).ticks(5).tickSizeOuter(0));
                yAxisGroup.transition(t).call(d3.axisLeft(yScale));
                
                // 条形图更新
                const bars = svg.selectAll(".bar").data(currentData, d => d.city);
                
                bars.exit().transition(t).attr("width", 0).remove();
                
                const barsEnter = bars.enter().append("rect").attr("class", "bar")
                    .attr("x", 0).attr("y", d => yScale(d.city))
                    .attr("height", yScale.bandwidth()).attr("width", 0)
                    .attr("fill", d => this.getColor(d.value, pollutant));
                    
                bars.merge(barsEnter).transition(t)
                    .attr("y", d => yScale(d.city))
                    .attr("width", d => xScale(d.value))
                    .attr("fill", d => this.getColor(d.value, pollutant));
                
                // 标签更新
                const labels = svg.selectAll(".bar-label").data(currentData, d => d.city);
                labels.exit().remove();
                
                labels.enter().append("text").attr("class", "bar-label").attr("dy", "0.35em")
                    .style("font-size", "10px").style("fill", "#333")
                    .merge(labels)
                    .transition(t)
                    .attr("x", d => xScale(d.value) + 5)
                    .attr("y", d => yScale(d.city) + yScale.bandwidth() / 2)
                    .text(d => d.value.toFixed(1));
            };

            // 初始渲染
            renderFrame();

            // 绑定交互逻辑
            const startTimer = () => {
                if(this.animationTimer) clearInterval(this.animationTimer);
                this.animationTimer = setInterval(() => {
                    currentMonthIndex = (currentMonthIndex + 1) % allMonths.length;
                    renderFrame();
                }, this.animationSpeed);
            };

            // 播放按钮逻辑
            playBtn.on("click", () => {
                this.isPlaying = !this.isPlaying;
                playBtn.html(this.isPlaying ? '⏸ 暂停' : '▶ 播放');
                if(this.isPlaying) startTimer();
                else this.stopAnimation(); 
            });

            // 速度选择逻辑
            speedSelect.on("change", (e) => {
                this.animationSpeed = parseInt(e.target.value);
                if(this.isPlaying) startTimer();
            });

        }).catch(err => {
            console.error(err);
            titleText.text(`${region} 数据加载失败`);
        });
    }
}