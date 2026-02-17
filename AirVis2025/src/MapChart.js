import * as d3 from 'd3';

// 地图可视化图表类
export class MapChart {
  /**
   * @param {string} containerId - 容器 DOM ID (如 "#map-container")
   * @param {Object} dataManager - 数据管理器实例
   * @param {Object} callbacks - 回调函数集合 { onHover, onDblClick }
   */
  constructor(containerId, dataManager, callbacks) {
    this.containerId = containerId;
    this.dataManager = dataManager;
    this.onCityHover = callbacks.onHover; 
    this.onCityDblClick = callbacks.onDblClick; 

    this.width = 0;
    this.height = 0;
    this.svg = null;
    this.zoom = null; 
    
    // 图层容器引用
    this.mapG = null;      // 底图层
    this.heatmapG = null;  // 热力图层
    this.boundaryG = null; // 边界线层
    this.pointsG = null;   // 城市点层

    // 状态变量
    this.geoJSON = null;        
    this.currentFeature = null; // 当前聚焦的地理特征 (null 表示全国)
    this.selectedCity = null;   // 当前选中的城市

    // D3 工具
    this.projection = null;
    this.path = null;
    this.colorScale = d3.scaleSequential(d3.interpolateRdYlBu);

    // 缓存上次渲染的热力图数据，用于 Resize 时重绘
    this.lastHeatmapData = null;
    this.lastPollutant = null;

    this.provinceTooltip = null;

    // 绑定窗口大小改变事件
    window.addEventListener('resize', () => {
        this.resize();
    });

    // 延迟初始化以确保容器已就绪
    setTimeout(() => this.init(), 100);
  }

// 初始化 SVG 容器和基础交互
  init() {
    const container = document.querySelector(this.containerId);
    if (!container) return;
    if (!this.dataManager.geoJSON) return;
    this.geoJSON = this.dataManager.geoJSON;

    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // 清理旧内容
    d3.select(this.containerId).select('svg').remove();
    d3.select("body").selectAll(".province-tooltip").remove(); 

    // 创建 SVG
    this.svg = d3.select(this.containerId).append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('background', 'transparent'); 

    // 创建省份名称提示框
    this.provinceTooltip = d3.select("body").append("div")
        .attr("class", "province-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.8)")
        .style("color", "#fff")
        .style("padding", "6px 12px")
        .style("border-radius", "4px")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("pointer-events", "none")
        .style("z-index", "9999")
        .style("transform", "translate(-50%, -150%)");

    // 定义滤镜 (高斯模糊用于热力图)
    const defs = this.svg.append("defs");
    const filter = defs.append("filter")
        .attr("id", "heatmap-blur")
        .attr("x", "-50%").attr("y", "-50%")
        .attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur")
        .attr("stdDeviation", "12") 
        .attr("result", "coloredBlur");

    // 初始化图层顺序：底图 -> 热力图 -> 边界线 -> 城市点
    this.mapG = this.svg.append('g').attr("class", "layer-base");
    this.heatmapG = this.svg.append('g').attr("class", "layer-heatmap");
    this.boundaryG = this.svg.append('g').attr("class", "layer-boundary");
    this.pointsG = this.svg.append('g').attr("class", "layer-points");

    // 初始化缩放行为
    this.zoom = d3.zoom()
        .scaleExtent([1, 50]) 
        .on("zoom", (event) => this.onZoom(event));

    this.svg.call(this.zoom)
        .on("dblclick.zoom", null); // 禁用双击缩放，保留双击用于钻取

    // 背景双击：返回全国视图
    this.svg.on("dblclick", (event) => {
        if (event.target.tagName === 'svg' && this.currentFeature) {
            this.resetToNational();
        }
    });

    this.updateLayout(null);
  }

  // 处理缩放事件
  onZoom(event) {
      const t = event.transform;
      
      this.mapG.attr("transform", t);
      this.heatmapG.attr("transform", t);
      this.boundaryG.attr("transform", t);
      this.pointsG.attr("transform", t);

      const k = t.k; 

      // 调整城市点大小 (缩放时点本身变小，保持相对视觉大小)
      this.pointsG.selectAll("circle")
          .attr("r", d => {
              const baseR = (d === this.selectedCity) ? 8 : 3; 
              return baseR / Math.sqrt(k); 
          })
          .attr("stroke-width", d => {
              const baseStroke = (d === this.selectedCity) ? 2 : 0; 
              return baseStroke / k;
          });

      this.boundaryG.selectAll("path")
          .attr("stroke-width", 1 / k);

      this.mapG.selectAll("path")
          .style("stroke-width", 1 / k);
          
      // 调整热力图半径
      this.heatmapG.selectAll("circle")
          .attr("r", (this.currentFeature ? 45 : 25) / Math.sqrt(k));
  }

  /**
   * 更新地图布局 (切换全国/省份视图)
   * @param {Object|null} targetFeature - GeoJSON Feature 对象，null 为全国
   */
  updateLayout(targetFeature) {
    this.currentFeature = targetFeature;
    const padding = 50;

    // 重新计算投影
    if (targetFeature) {
        this.projection = d3.geoMercator()
            .fitExtent([[padding, padding], [this.width - padding, this.height - padding]], targetFeature);
    } else {
        this.projection = d3.geoMercator()
            .fitExtent([[padding, padding], [this.width - padding, this.height - padding]], this.geoJSON);
    }
    this.path = d3.geoPath().projection(this.projection);

    // 重置缩放
    if (this.svg && this.zoom) {
        this.svg.transition().duration(750).call(this.zoom.transform, d3.zoomIdentity);
    }

    const clipFeatureCollection = targetFeature 
        ? { type: "FeatureCollection", features: [targetFeature] } 
        : this.geoJSON;

    // 更新 ClipPath，确保热力图不溢出边界
    this.svg.select("defs").select("#map-clip").remove();
    let defs = this.svg.select("defs");
    if(defs.empty()) defs = this.svg.append("defs");

    defs.append("clipPath")
        .attr("id", "map-clip")
        .selectAll("path")
        .data(clipFeatureCollection.features)
        .enter().append("path")
        .attr("d", this.path);
    
    this.heatmapG.attr("clip-path", "url(#map-clip)");

    this.renderBaseMap(clipFeatureCollection.features);
    this.renderBoundaries(clipFeatureCollection.features);
    this.renderCities();
    
    // 如果有缓存数据，重新渲染热力图
    if (this.lastHeatmapData && this.lastPollutant) {
        this.updateHeatmap(this.lastHeatmapData, this.lastPollutant);
    }
  }

  // 渲染基础地图
  renderBaseMap(features) {
    const paths = this.mapG.selectAll("path").data(features, d => d.properties.id || d.properties.name);
    paths.exit().remove();

    const pathsEnter = paths.enter().append("path")
      .attr("fill", "#e0e6ed")      
      .attr("stroke", "#999") 
      .attr("stroke-width", 1) 
      .style("cursor", "pointer")
      .style("pointer-events", "all");

    const allPaths = paths.merge(pathsEnter);

    allPaths
      .transition().duration(750)
      .attr("d", this.path);

    // 绑定交互事件
    allPaths
      .on("mouseover", (event, d) => {
          const currentK = d3.zoomTransform(this.svg.node()).k;
          d3.select(event.currentTarget)
            .attr("fill", "#cfd9e6") 
            .attr("stroke", "#666") 
            .attr("stroke-width", 3 / currentK) 
            .raise(); 

          this.provinceTooltip
            .style("opacity", 1)
            .text(d.properties.name)
            .style("left", (event.pageX) + "px")
            .style("top", (event.pageY) + "px");
      })
      .on("mousemove", (event) => {
          this.provinceTooltip
            .style("left", (event.pageX) + "px")
            .style("top", (event.pageY) + "px");
      })
      .on("mouseout", (event, d) => {
          const currentK = d3.zoomTransform(this.svg.node()).k;
          d3.select(event.currentTarget)
            .attr("fill", "#e0e6ed")
            .attr("stroke", "#999")
            .attr("stroke-width", 1 / currentK);
          
          this.provinceTooltip.style("opacity", 0);
      })
      .on("dblclick", (event, d) => {
          event.stopPropagation(); 
          if (!this.currentFeature) {
              this.enterProvinceView(d);
          }
      });
  }

// 渲染边界线
  renderBoundaries(features) {
    const paths = this.boundaryG.selectAll("path").data(features, d => d.properties.id || d.properties.name);
    paths.exit().remove();
    paths.enter().append("path")
      .merge(paths)
      .transition().duration(750)
      .attr("d", this.path)
      .attr("fill", "none")         
      .attr("stroke", "#fff")    
      .attr("stroke-width", 1) 
      .style("pointer-events", "none");
  }

  renderCities() {
    const coords = this.dataManager.cityCoords;
    let cities = (this.dataManager.validCities && this.dataManager.validCities.length > 0)
                   ? this.dataManager.validCities 
                   : Object.keys(coords);

    // 过滤可视区域内的城市
    const visibleCities = cities.filter(city => {
        const coord = coords[city];
        if (!coord) return false;
        if (this.currentFeature) {
            return d3.geoContains(this.currentFeature, coord);
        }
        return true; 
    });

    const circles = this.pointsG.selectAll("circle")
      .data(visibleCities, d => d);

    circles.exit().transition().duration(500).attr("r", 0).remove();

    const circlesEnter = circles.enter().append("circle")
      .attr("r", 0);

    const allCircles = circles.merge(circlesEnter);

    allCircles
      .attr("cx", d => this.projection(coords[d])[0])
      .attr("cy", d => this.projection(coords[d])[1]);

    if (!this.currentFeature) {
        // 全国视图模式：点变灰变小，不可交互
        allCircles
            .style("pointer-events", "none") 
            .attr("fill", "#888888") 
            .attr("stroke", "none")
            .transition().duration(750)
            .attr("r", 3); 
    } else {
        // 省份钻取模式：点变大，可交互
        allCircles
            .style("pointer-events", "all") 
            .style("cursor", "pointer")
            .attr("fill", d => (d === this.selectedCity ? "#e74c3c" : "rgba(44, 62, 80, 0.6)")) 
            .attr("stroke", "#fff")
            .attr("stroke-width", d => (d === this.selectedCity ? 2 : 1))
            .transition().duration(750)
            .attr("r", d => (d === this.selectedCity ? 8 : 5)); 
        
        allCircles
            .on("click", (event, d) => {
                event.stopPropagation();
                this.selectedCity = d;
                this.renderCities(); 
                if (this.onCityHover) this.onCityHover(d);
            })
            .on("dblclick", (event, d) => {
                event.stopPropagation();
                if (this.onCityDblClick) this.onCityDblClick(d);
            })
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget).attr("fill", "#e74c3c");
                this.showTooltip(event, d);
            })
            .on("mouseout", (event, d) => {
                if (d !== this.selectedCity) {
                    d3.select(event.currentTarget).attr("fill", "rgba(44, 62, 80, 0.6)");
                }
                d3.select("body").select(".city-tooltip").remove();
            });
    }
  }

  // 显示城市提示框
  showTooltip(event, text) {
      d3.select("body").select(".city-tooltip").remove();
      d3.select("body").append("div")
          .attr("class", "city-tooltip") 
          .style("opacity", 1)
          .html(text)
          .style("position", "absolute")
          .style("background", "rgba(50, 50, 50, 0.9)")
          .style("color", "#fff")
          .style("padding", "5px 10px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("z-index", "10000")
          .style("left", (event.pageX + 15) + "px")
          .style("top", (event.pageY - 10) + "px");
  }

// 进入省份视图
  enterProvinceView(feature) {
      this.provinceTooltip.style("opacity", 0); 
      this.updateLayout(feature);
  }

  // 返回全国视图
  resetToNational() {
      this.provinceTooltip.style("opacity", 0);
      this.updateLayout(null);
  }

  // 处理窗口大小改变
  resize() {
      if (!this.svg) return;
      const container = document.querySelector(this.containerId);
      this.width = container.clientWidth;
      this.height = container.clientHeight;
      this.svg.attr("width", this.width).attr("height", this.height);
      this.updateLayout(this.currentFeature);
  }

  /**
   * 更新热力图层
   * @param {Object} dataMap - { "城市名": 数值, ... }
   * @param {string} pollutant - 污染物类型
   */
  updateHeatmap(dataMap, pollutant) {
    this.lastHeatmapData = dataMap;
    this.lastPollutant = pollutant;
    
    if (!this.heatmapG || !this.projection) return;

    const coords = this.dataManager.cityCoords;
    const cities = Object.keys(dataMap).filter(city => {
        if (!coords[city]) return false;
        if (this.currentFeature) return d3.geoContains(this.currentFeature, coords[city]);
        return true;
    });

    // 动态计算最大值，控制颜色映射范围
    let maxVal = 150; 
    if (pollutant === 'AQI') maxVal = 200;
    if (pollutant === 'PM2.5') maxVal = 150;
    if (pollutant === 'PM10') maxVal = 150;
    if (pollutant === 'CO') maxVal = 2;
    if (pollutant === 'SO2') maxVal = 80;
    if (pollutant === 'NO2') maxVal = 80;
    if (pollutant === 'O3') maxVal = 160;

    const circles = this.heatmapG.selectAll("circle")
        .data(cities, d => d);

    circles.exit().remove();

    circles.enter().append("circle")
        .merge(circles)
        .attr("cx", d => this.projection(coords[d])[0])
        .attr("cy", d => this.projection(coords[d])[1])
        .attr("r", this.currentFeature ? 45 : 25) 
        .style("filter", "url(#heatmap-blur)") // 应用模糊滤镜实现热力效果
        .style("opacity", 0.8) 
        .style("pointer-events", "none") 
        .transition().duration(500)
        .attr("fill", d => {
            const val = dataMap[d];
            let t = val / maxVal;
            if (t > 1) t = 1;
            // 颜色反转：数值越大越红 (RdYlBu 的反向)
            return this.colorScale(1 - t);
        });
  }
}