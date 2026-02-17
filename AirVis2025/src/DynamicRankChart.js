import * as d3 from 'd3';

// 标记变量，防止重复初始化监听器
let isInitialized = false;

// 污染物颜色映射表
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
 * 初始化动态排名图表 (Racing Bar Chart)
 * @param {string} pollutant - 初始污染物类型
 */
export function initDynamicRank(pollutant = 'AQI') {
    // 状态管理：确保监听器只绑定一次
    if (isInitialized) {
        // 如果已初始化，后续只更新数据逻辑，这里简化为重新执行
    }
    isInitialized = true;

    console.log(`启动动态排名图表... 污染物：${pollutant}`);

    // --- 内部变量 ---
    let currentPollutant = pollutant;
    let currentRegion = '东北'; // 默认区域
    let currentRankType = 'best'; // best (升序) or worst (降序)
    let cityCount = 15;
    let isPlaying = false;
    let animationSpeed = 2000;
    let animationTimer = null;
    let currentMonthIndex = 0;
    let allMonths = [];
    let chartData = {};
    let previousData = null;
    let isFirstRender = true;

    const monthLabels = {
        'Jan': '1月', 'Feb': '2月', 'Mar': '3月', 'Apr': '4月',
        'May': '5月', 'Jun': '6月', 'Jul': '7月', 'Aug': '8月',
        'Sep': '9月', 'Oct': '10月', 'Nov': '11月', 'Dec': '12月'
    };

    // --- DOM 准备 ---
    const margin = { top: 60, right: 100, bottom: 80, left: 120 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // 清理旧 SVG
    d3.select('#chart').selectAll("*").remove();

    const svg = d3.select('#chart')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 工具提示
    d3.select('.tooltip').remove(); 
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '10px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('z-index', '1000');

    // --- 辅助函数 ---
    function getPollutantColor(value) {
        const standard = POLLUTANT_STANDARDS[currentPollutant] || POLLUTANT_STANDARDS['AQI'];
        for (let i = 0; i < standard.stops.length; i++) {
            if (value <= standard.stops[i]) {
                return standard.colors[i];
            }
        }
        return standard.colors[standard.colors.length - 1];
    }

    function getAQILevel(aqi) {
        if (aqi <= 50) return '优';
        if (aqi <= 100) return '良';
        if (aqi <= 150) return '轻度污染';
        if (aqi <= 200) return '中度污染';
        if (aqi <= 300) return '重度污染';
        return '严重污染';
    }

    // --- 事件监听 (仅在第一次初始化时绑定) ---
    function initEventListeners() {
        const regionSelect = document.getElementById('region-select');
        if(regionSelect) {
            regionSelect.onchange = function() {
                currentRegion = this.value;
                resetAndReload();
            };
        }
        
        const rankRadios = document.querySelectorAll('input[name="rank-type"]');
        rankRadios.forEach(radio => {
            radio.onchange = function() {
                currentRankType = this.value;
                resetAndReload();
            };
        });
        
        const countSlider = document.getElementById('city-count');
        if(countSlider) {
            countSlider.oninput = function() {
                cityCount = parseInt(this.value);
                const valDisplay = document.getElementById('city-count-value');
                if(valDisplay) valDisplay.textContent = cityCount;
                resetAndReload();
            };
        }
        
        const playBtn = document.getElementById('play-pause');
        if(playBtn) {
            playBtn.onclick = function() {
                isPlaying = !isPlaying;
                const icon = document.getElementById('play-icon');
                if(icon) icon.textContent = isPlaying ? '⏸' : '▶';
                this.innerHTML = `<span id="play-icon">${isPlaying ? '⏸' : '▶'}</span> ${isPlaying ? '暂停' : '播放'}`;
                
                if (isPlaying) startAnimation();
                else stopAnimation();
            };
        }
        
        const resetBtn = document.getElementById('reset');
        if(resetBtn) {
            resetBtn.onclick = function() {
                stopAnimation();
                isPlaying = false;
                currentMonthIndex = 0;
                const pBtn = document.getElementById('play-pause');
                if(pBtn) pBtn.innerHTML = '<span id="play-icon">▶</span> 播放';
                resetAndReload();
            };
        }
        
        const speedSelect = document.getElementById('speed-select');
        if(speedSelect) {
            speedSelect.onchange = function() {
                animationSpeed = parseInt(this.value);
                if (isPlaying) {
                    stopAnimation();
                    startAnimation();
                }
            };
        }
    }

    function resetAndReload() {
        isFirstRender = true;
        previousData = null;
        loadDataAndRender();
    }

    // --- 数据加载 ---
    async function loadDataAndRender() {
        // 构建 CSV 路径: ./data/AQI_monthmean_东北.csv
        const url = `./data/${currentPollutant}_monthmean_${currentRegion}.csv`;
        console.log(`加载数据: ${url}`);
        
        try {
            const csvData = await d3.csv(url);
            if (!csvData || csvData.length === 0) throw new Error('CSV为空');
            
            processCSVData(csvData);
            
            if (currentMonthIndex >= allMonths.length) currentMonthIndex = 0;
            updateTimeDisplay();
            renderChart();

        } catch (error) {
            console.warn(`数据加载失败: ${error.message}`);
            svg.selectAll("*").remove();
            svg.append("text").attr("x", width/2).attr("y", height/2)
               .attr("text-anchor", "middle").text(`暂无 ${currentRegion} ${currentPollutant} 数据`);
        }
    }

    function processCSVData(csvData) {
        allMonths = [];
        chartData = {};
        
        csvData.forEach(row => {
            const month = row.month;
            if (!month) return;
            allMonths.push(month);
            
            const cityData = [];
            for (const [city, valStr] of Object.entries(row)) {
                if (city !== 'month' && valStr !== '' && valStr !== undefined) {
                    const val = parseFloat(valStr);
                    if (!isNaN(val)) {
                        cityData.push({ city: city, value: val });
                    }
                }
            }
            
            // 排序
            cityData.sort((a, b) => {
                return currentRankType === 'best' 
                    ? a.value - b.value  // 升序 (数值越小越好)
                    : b.value - a.value; // 降序 (数值越大越差)
            });
            
            // 添加排名索引
            cityData.forEach((d, i) => d.rank = i + 1);
            
            // 截取 Top N
            chartData[month] = cityCount ? cityData.slice(0, cityCount) : cityData;
        });
    }

    // --- 渲染逻辑 ---
    function updateTimeDisplay() {
        if (allMonths.length > 0 && currentMonthIndex < allMonths.length) {
            const monthStr = allMonths[currentMonthIndex];
            // 格式化日期显示
            let year, month;
            if (monthStr.includes('-')) {
                [year, month] = monthStr.split('-');
            } else {
                year = monthStr.substring(0, 2);
                month = monthStr.substring(2);
            }
            const fullYear = year.length === 2 ? "20" + year : year;
            const monthLabel = monthLabels[month] || month + "月";
            
            const timeEl = document.getElementById('current-time');
            if(timeEl) timeEl.textContent = `${fullYear}年 ${monthLabel}`;
            
            const rankTypeText = currentRankType === 'best' ? '最佳' : '最差';
            const titleEl = document.getElementById('chart-title');
            if(titleEl) {
                titleEl.textContent = `${currentRegion} ${currentPollutant} ${rankTypeText}排名动态`;
            }
        }
    }

    function renderChart() {
        if (allMonths.length === 0 || !chartData[allMonths[currentMonthIndex]]) return;
        
        const currentData = chartData[allMonths[currentMonthIndex]];
        
        // Y轴: 城市
        const yScale = d3.scaleBand()
            .domain(currentData.map(d => d.city))
            .range([0, height])
            .padding(0.2);
        
        // X轴: 数值
        const maxVal = d3.max(currentData, d => d.value) || 100;
        const xScale = d3.scaleLinear()
            .domain([0, maxVal * 1.1])
            .range([0, width]);
        
        // 绘制坐标轴
        let xAxisGroup = svg.select('.x-axis');
        if (xAxisGroup.empty()) {
            xAxisGroup = svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0, ${height})`);
        }
        let yAxisGroup = svg.select('.y-axis');
        if (yAxisGroup.empty()) {
            yAxisGroup = svg.append('g').attr('class', 'y-axis');
        }
        
        const t = d3.transition().duration(animationSpeed).ease(d3.easeLinear);

        xAxisGroup.transition(t).call(d3.axisBottom(xScale).ticks(5));
        yAxisGroup.transition(t).call(d3.axisLeft(yScale));
        
        // 数据绑定
        const bars = svg.selectAll('.bar').data(currentData, d => d.city);
        
        // 1. Exit
        bars.exit()
            .transition(t)
            .attr('width', 0)
            .attr('y', height)
            .remove();
        
        // 2. Enter
        const barsEnter = bars.enter().append('rect')
            .attr('class', 'bar')
            .attr('x', 0)
            .attr('y', d => yScale(d.city)) 
            .attr('height', yScale.bandwidth())
            .attr('width', 0)
            .attr('fill', d => getPollutantColor(d.value))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);
        
        // 3. Update + Enter Merge
        bars.merge(barsEnter).transition(t)
            .attr('y', d => yScale(d.city))
            .attr('height', yScale.bandwidth())
            .attr('width', d => xScale(d.value))
            .attr('fill', d => getPollutantColor(d.value));
        
        // 数值标签
        const labels = svg.selectAll('.bar-label').data(currentData, d => d.city);
        labels.exit().transition(t).attr('x', 0).remove();
        
        const labelsEnter = labels.enter().append('text')
            .attr('class', 'bar-label')
            .attr('x', 0)
            .attr('y', d => yScale(d.city) + yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .style('font-size', '10px')
            .style('fill', '#333')
            .text(d => d.value.toFixed(1));
            
        labels.merge(labelsEnter).transition(t)
            .attr('x', d => xScale(d.value) + 5)
            .attr('y', d => yScale(d.city) + yScale.bandwidth() / 2)
            .text(d => d.value.toFixed(1));

        // 交互事件
        bars.merge(barsEnter)
            .on('mouseover', function(event, d) {
                if(isPlaying) stopAnimation();
                
                tooltip.transition().duration(200).style('opacity', .9);
                tooltip.html(`
                    <strong>${d.city}</strong><br/>
                    ${currentPollutant}: ${d.value.toFixed(1)}<br/>
                    等级: ${getAQILevel(d.value)}<br/>
                    排名: 第${d.rank}名
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
                
                d3.select(this).attr('stroke', '#333').attr('stroke-width', 2);
            })
            .on('mouseout', function(event, d) {
                if(isPlaying && !animationTimer) startAnimation();
                tooltip.transition().duration(500).style('opacity', 0);
                d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1);
            });
            
        previousData = currentData;
        isFirstRender = false;
    }

    function startAnimation() {
        if (animationTimer) clearInterval(animationTimer);
        animationTimer = setInterval(() => {
            currentMonthIndex = (currentMonthIndex + 1) % allMonths.length;
            updateTimeDisplay();
            renderChart();
        }, animationSpeed);
    }

    function stopAnimation() {
        if (animationTimer) {
            clearInterval(animationTimer);
            animationTimer = null;
        }
    }

    initEventListeners();
    loadDataAndRender();
}