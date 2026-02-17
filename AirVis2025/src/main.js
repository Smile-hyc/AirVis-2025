import * as d3 from 'd3';
import { DataManager } from './DataManager.js';
import { MapChart } from './MapChart.js';
import { drawRadar } from './RadarChart.js';
import { Legend } from './Legend.js'; 
import { RegionalDashboard } from './RegionalDashboard.js'; 
import { initDynamicRank } from './DynamicRankChart.js'; 

//全局动态变量
const dataManager = new DataManager();
let currentCity = "北京"; 
let currentDateIndex = 0; 
let currentPollutant = "AQI";

//图表实例
let mapChart = null;
let legend = null; 
let regionalDashboard = null; // 城市深度分析面板 (替换原 RegionalAnalysis)
let tianjinCreative = null;

//状态控制
let tianjinPollutant = 'AQI';
let tianjinMetric = 'max';
let currentCreativeType = 'radial'; 
let selectedMonth = 1;
let selectedDay = 1;
let isMonthDetailMode = false;

//入口
async function initApp() {
  try {
    //数据初始化
    await dataManager.init();
    await dataManager.loadAllData();
    
    // 实例化图表组件
    tianjinCreative = new RegionalDashboard("#creative-chart-container"); 
    regionalDashboard = new RegionalDashboard("#regional-dashboard");

    mapChart = new MapChart("#map-container", dataManager, {
      onHover: (cityName) => {
        currentCity = cityName;
        updateRadar();
        updateRightPanelInfo();
      },
      onDblClick: (cityName) => {
          enterDrillDownMode(cityName);
      }
    });

    legend = new Legend("#legend-target");

    // 初始化 UI 控件
    initControls(); 
    initNavigation(); 
    initTimeSlider();
    initDatePicker();
    
    // 绑定返回按钮事件
    d3.select("#btn-exit-drilldown").on("click", handleBackButtonClick);

    // 准备天津数据
    prepareTianjinData();

    // 首次渲染
    setTimeout(() => {
        updateAllViews();
        document.getElementById('loading-screen').style.display = 'none';
    }, 500);

  } catch (error) {
    console.error("初始化出错:", error);
  }
}


// 交互逻辑：钻取模式
function enterDrillDownMode(cityName) {
    const mainView = document.getElementById("view-national");
    if (!mainView) return;

    currentCity = cityName; 
    isMonthDetailMode = false; 

    // 添加 CSS 类触发布局变化
    mainView.classList.add("drill-down-mode");
    d3.select("#drilldown-city-title").text(`${cityName} 2025年深度分析`);
    d3.select("#btn-exit-drilldown").html('<i class="fa fa-times"></i> 返回全国地图');

    renderDashboardView();

    // 调整地图大小以适应左上角小窗口
    setTimeout(() => { 
        if (mapChart) mapChart.resize(); 
    }, 600);
}

// 渲染年度仪表盘视图
function renderDashboardView() {
    const cityData = dataManager.getCity2025Data(currentCity, currentPollutant, 'max');
    const nationalDailyData = dataManager.getNationalDailyMean(currentPollutant);

    if (regionalDashboard) {
        // 渲染主仪表盘 (星云、山峦、雨云、排名)
        regionalDashboard.renderDashboard(cityData, currentPollutant, nationalDailyData);
        
        // 渲染侧边栏日历
        regionalDashboard.renderCalendar(cityData, currentPollutant, "#sidebar-calendar-container");
        
        // 渲染动态排名图块
        const region = dataManager.getCityRegion(currentCity);
        regionalDashboard.renderDynamicRanking("#cell-dynamic", region, currentPollutant);
        
        // 绑定交互事件
        regionalDashboard.onMonthClick = (monthIndex, allData, pollutant) => {
            enterMonthDetailMode(monthIndex, allData, pollutant);
        };

        // 绑定山峦图双击事件
        regionalDashboard.onRidgelineDblClick = (monthIndex) => {
            const nationalMonthData = dataManager.getNationalMonthData(currentPollutant, monthIndex);
            regionalDashboard.renderRidgelineCellDetail(monthIndex, nationalMonthData);
        };
    }
}

// 渲染月度详情视图
function enterMonthDetailMode(monthIndex, allData, pollutant) {
    isMonthDetailMode = true;
    d3.select("#drilldown-city-title").text(`${currentCity} ${monthIndex + 1}月详情`);
    d3.select("#btn-exit-drilldown").html('<i class="fa fa-arrow-left"></i> 返回年度概览');
    regionalDashboard.renderMonthDetail(monthIndex, allData, [], pollutant); 
}

// 处理返回按钮点击
function handleBackButtonClick() {
    if (isMonthDetailMode) {
        // 如果在月度详情页，返回年度仪表盘
        isMonthDetailMode = false;
        d3.select("#drilldown-city-title").text(`${currentCity} 2025年深度分析`);
        d3.select("#btn-exit-drilldown").html('<i class="fa fa-times"></i> 返回全国地图');
        renderDashboardView(); 
    } else {
        // 如果在年度仪表盘，退出钻取模式
        exitDrillDownMode();
    }
}

// 退出钻取模式
function exitDrillDownMode() {
    const mainView = document.getElementById("view-national");
    if (!mainView) return;
    if(regionalDashboard) regionalDashboard.stopAnimation();

    mainView.classList.remove("drill-down-mode");
    
    // 恢复地图交互和布局
    setTimeout(() => { if (mapChart) mapChart.init(); updateAllViews(); }, 600);
}

//初始化与控件绑定
function initControls() {
    const select = d3.select("#pollutant-select");
    select.selectAll("option")
    .data(dataManager.pollutants).enter()
    .append("option").text(d => d).attr("value", d => d);
    
    select.on("change", function() {
        currentPollutant = this.value;
        d3.select("#current-type").text(currentPollutant);
        updateAllViews();
        
        // 如果在动态视图，更新动态图
        if (!d3.select("#view-dynamic").classed("hidden")) {
            initDynamicRank(currentPollutant);
        }
    
        // 如果在钻取模式，更新仪表盘
        if (document.getElementById("view-national").classList.contains("drill-down-mode") && !isMonthDetailMode) {
            renderDashboardView();
        }
    });
}

function initNavigation() {
    const btns = d3.selectAll(".nav-btn");
    const views = d3.selectAll(".view-section");
    const controls = d3.select("#national-controls");

    btns.on("click", function() {
        if(this.getAttribute("onclick")) return; // 忽略内联点击事件的按钮
        const target = d3.select(this).attr("data-target");
        if(!target) return;
        
        d3.selectAll(".nav-group .nav-btn").classed("active", false);
        d3.select(this).classed("active", true);

        views.classed("hidden", true);
        d3.select(`#view-${target}`).classed("hidden", false);

        if (target === "national") {
            controls.style("display", "flex");
            if(mapChart) setTimeout(() => { mapChart.resize(); updateAllViews(); }, 50);
        } else if (target === "tianjin") {
            controls.style("display", "none");
            d3.select("#view-creative").style("display", "block");
            setTimeout(() => { updateCreativeChart(currentCreativeType); }, 50);
        } else if (target === "dynamic") {
            controls.style("display", "none");
            const dynamicPollutantSelect = document.getElementById('pollutant-select');
            if (dynamicPollutantSelect) {
                dynamicPollutantSelect.value = currentPollutant;
            }
            setTimeout(() => initDynamicRank(currentPollutant), 50);
        }
    });
}

// 暴露给 HTML onclick 使用的函数
window.switchCreativeView = function(chartType) {
    const container = document.querySelector("#view-creative .controls");
    if(container) {
        const btns = container.querySelectorAll(".nav-btn");
        btns.forEach(b => b.classList.remove("active"));
        const targetBtn = Array.from(btns).find(b => b.getAttribute("onclick").includes(chartType));
        if(targetBtn) targetBtn.classList.add("active");
    }
    updateCreativeChart(chartType);
};

function initTianjinControls() {
    d3.select("#tianjin-pollutant-select").on("change", function() {
        tianjinPollutant = this.value;
        updateCreativeChart(); 
    });
    d3.select("#tianjin-metric-select").on("change", function() {
        tianjinMetric = this.value;
        updateCreativeChart(); 
    });
}

function prepareTianjinData() {
    initTianjinControls();
}

function updateCreativeChart(chartType) {
    if (chartType) currentCreativeType = chartType;
    if (!tianjinCreative) return;
    
    // 复用 DataManager 获取特定城市数据
    let rawData = dataManager.getCity2025Data('天津', tianjinPollutant, tianjinMetric);
    if (rawData.length === 0) return;
    
    // 调用 RegionalDashboard 中的具体绘图方法
    if (currentCreativeType === 'radial') tianjinCreative.renderRadial(rawData, tianjinPollutant);
    else if (currentCreativeType === 'ridgeline') tianjinCreative.renderRidgeline(rawData, tianjinPollutant);
    else if (currentCreativeType === 'raincloud') tianjinCreative.renderRaincloud(rawData, tianjinPollutant);
    else if (currentCreativeType === 'calendar') tianjinCreative.renderCalendar(rawData, tianjinPollutant);
    
    tianjinCreative.onMonthClick = (m, d, p) => {
        console.log("Creative View Clicked Month:", m + 1);
    };
}

// 时间轴与数据更新逻辑
function initTimeSlider() {
    const slider = d3.select("#date-slider");
    if (dataManager.datasets['AQI']) {
        slider.attr("max", dataManager.datasets['AQI'].length - 1);
    }
    slider.on("input", function() {
        currentDateIndex = +this.value;
        updateBubbleAndViews();
    });
    updateBubbleAndViews();
}

function updateBubbleAndViews() {
    const bubble = d3.select("#date-bubble");
    const slider = d3.select("#date-slider");
    const dateStr = dataManager.getDateString(currentPollutant, currentDateIndex);
    bubble.text(dateStr || "Loading...");
    
    // 更新滑块气泡位置
    const maxVal = parseFloat(slider.attr("max")) || 365;
    const minVal = parseFloat(slider.attr("min")) || 0;
    const val = currentDateIndex; 
    const percent = (val - minVal) / (maxVal - minVal);
    const width = slider.node() ? slider.node().getBoundingClientRect().width : 200;
    const thumbWidth = 16; 
    const leftPos = percent * (width - thumbWidth) + (thumbWidth / 2);
    bubble.style("left", `${leftPos}px`); 
    
    updateAllViews();
}

// 日期选择器逻辑
function initDatePicker() {
    const dateBadge = d3.select("#info-date");
    const modal = d3.select("#date-picker-modal");
    const confirmBtn = d3.select("#picker-confirm-btn");
    const monthCol = d3.select("#picker-month");
    const dayCol = d3.select("#picker-day");
    
    dateBadge.on("click", () => { modal.classed("show", true); renderPickerItems(); });

    // 渲染月份和日期选项
    function renderPickerItems() {
        monthCol.html("");
        for(let m=1; m<=12; m++) {
            monthCol.append("div")
                .attr("class", `picker-item ${m === selectedMonth ? 'selected' : ''}`)
                .text(`${m}月`)
                .on("click", function() { selectedMonth = m; selectedDay = 1; renderPickerItems(); });
        }
        dayCol.html("");
        const dInM = dataManager.daysInMonth[selectedMonth - 1] || 30;
        for(let d=1; d<=dInM; d++) {
            dayCol.append("div")
                .attr("class", `picker-item ${d === selectedDay ? 'selected' : ''}`)
                .text(`${d}日`)
                .on("click", function() { selectedDay = d; renderPickerItems(); });
        }
    }
    // 确认按钮事件
    confirmBtn.on("click", () => {
        const newIndex = dataManager.getIndexFromDate(selectedMonth, selectedDay);
        currentDateIndex = newIndex;
        d3.select("#date-slider").property("value", newIndex);
        updateBubbleAndViews();
        modal.classed("show", false);
    });
}

// 更新所有视图
function updateAllViews() {
    if (!d3.select("#view-national").classed("hidden")) {
        updateMapColor(); 
        updateRadar();
        updateRightPanelInfo();
        if (legend) legend.update(currentPollutant);
    }
}

// 更新地图颜色
function updateMapColor() {
    if (!mapChart) return;
    const mapData = dataManager.getDailyMapData(currentDateIndex, currentPollutant);
    mapChart.updateHeatmap(mapData, currentPollutant);
}

// 更新雷达图
function updateRadar() {
  const cityRadar = dataManager.getRadarData(currentCity, currentDateIndex);
  const natRadar = dataManager.getNationalRadarData(currentDateIndex);

  const container = d3.select("#radar-container");
  container.html(""); 

  if (cityRadar && cityRadar[0] && cityRadar[0].length > 0) {
      let combinedData = [cityRadar[0]];
      if (natRadar && natRadar[0] && natRadar[0].length > 0) {
          combinedData.push(natRadar[0]);
      }

      drawRadar("#radar-container", combinedData, { 
          w: 200, 
          h: 200, 
          maxValue: 1, 
          color: d3.scaleOrdinal().range(["#4a90e2", "#999999"]),
          seriesLabels: [currentCity, "全国均值"] 
      });
  } else {
    container.html("<p class='placeholder-text'>暂无数据</p>");
  }
}

// 更新右侧信息面板，显示当前城市和日期信息
function updateRightPanelInfo() {
  d3.select("#info-city-name").text(currentCity);
  const dateStr = dataManager.getDateString(currentPollutant, currentDateIndex);
  d3.select("#info-date").text(dateStr || "--");
  const val = dataManager.getValue(currentPollutant, currentDateIndex, currentCity);
  d3.select("#info-value").text(val !== undefined ? parseFloat(val).toFixed(2) : "-");
  const unit = currentPollutant === 'CO' ? 'mg/m³' : 'μg/m³';
  d3.select("#info-unit").text(currentPollutant === 'AQI' ? '' : unit);
}

initApp();