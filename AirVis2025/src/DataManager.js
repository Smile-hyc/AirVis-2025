import * as d3 from 'd3';

// --- 基础数据文件路径配置 ---
// 请确保您的文件夹结构中，index.html 同级有一个 data 文件夹
const CONFIG = {
    typeURL: "./data/type.csv",
    cityURL: "./data/citynamewithlocation.csv",
    mapURL:  "./data/china.json", // <--- 重点检查这个文件是否存在
    // 污染物数据文件映射
    pollutantFiles: {
        'AQI':   { max: "./data/AQI_daymax.csv",   mean: "./data/AQI_daymean.csv",   min: "./data/AQI_daymin.csv" },
        'PM2.5': { max: "./data/PM2.5_daymax.csv", mean: "./data/PM2.5_daymean.csv", min: "./data/PM2.5_daymin.csv" },
        'PM10':  { max: "./data/PM10_daymax.csv",  mean: "./data/PM10_daymean.csv",  min: "./data/PM10_daymin.csv" },
        'SO2':   { max: "./data/SO2_daymax.csv",   mean: "./data/SO2_daymean.csv",   min: "./data/SO2_daymin.csv" },
        'NO2':   { max: "./data/NO2_daymax.csv",   mean: "./data/NO2_daymean.csv",   min: "./data/NO2_daymin.csv" },
        'CO':    { max: "./data/CO_daymax.csv",    mean: "./data/CO_daymean.csv",    min: "./data/CO_daymin.csv" },
        'O3':    { max: "./data/O3_daymax.csv",    mean: "./data/O3_daymean.csv",    min: "./data/O3_daymin.csv" }
    }
};

/**
 * 数据管理类
 * 负责加载 CSV/GeoJSON 数据，进行清洗、缓存，并提供给各图表组件使用。
 */
export class DataManager {
  constructor() {
    this.pollutants = []; // 污染物类型列表
    this.datasets = {};   // 缓存 2025 年主要数据 (metric='mean' 或 'max')
    this.detailedDatasets = {}; // 缓存所有指标数据 (max, mean, min)
    this.geoJSON = null;  // 地图 GeoJSON 数据
    this.cityCoords = {}; // 城市经纬度映射 { "北京": [116.4, 39.9], ... }
    this.validCities = []; // 有有效数据的城市列表
    this.daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    // 城市所属区域映射表 (用于动态排名图)
    this.cityRegionMap = {
        "沈阳": "东北", "大连": "东北", "哈尔滨": "东北", "长春": "东北", "鞍山": "东北", "抚顺": "东北", "本溪": "东北", "丹东": "东北", "锦州": "东北", "营口": "东北", "阜新": "东北", "辽阳": "东北", "盘锦": "东北", "铁岭": "东北", "朝阳": "东北", "葫芦岛": "东北", "吉林": "东北", "四平": "东北", "辽源": "东北", "通化": "东北", "白山": "东北", "松原": "东北", "白城": "东北", "齐齐哈尔": "东北", "鸡西": "东北", "鹤岗": "东北", "双鸭山": "东北", "大庆": "东北", "伊春": "东北", "佳木斯": "东北", "七台河": "东北", "牡丹江": "东北", "黑河": "东北", "绥化": "东北",
        "北京": "华北", "天津": "华北", "石家庄": "华北", "太原": "华北", "呼和浩特": "华北", "唐山": "华北", "秦皇岛": "华北", "邯郸": "华北", "邢台": "华北", "保定": "华北", "张家口": "华北", "承德": "华北", "沧州": "华北", "廊坊": "华北", "衡水": "华北", "大同": "华北", "阳泉": "华北", "长治": "华北", "晋城": "华北", "朔州": "华北", "晋中": "华北", "运城": "华北", "忻州": "华北", "临汾": "华北", "吕梁": "华北", "包头": "华北", "乌海": "华北", "赤峰": "华北", "通辽": "华北", "鄂尔多斯": "华北", "呼伦贝尔": "华北", "巴彦淖尔": "华北", "乌兰察布": "华北",
        "上海": "华东", "南京": "华东", "杭州": "华东", "合肥": "华东", "福州": "华东", "南昌": "华东", "济南": "华东", "无锡": "华东", "徐州": "华东", "常州": "华东", "苏州": "华东", "南通": "华东", "连云港": "华东", "淮安": "华东", "盐城": "华东", "扬州": "华东", "镇江": "华东", "泰州": "华东", "宿迁": "华东", "宁波": "华东", "温州": "华东", "嘉兴": "华东", "湖州": "华东", "绍兴": "华东", "金华": "华东", "衢州": "华东", "舟山": "华东", "台州": "华东", "丽水": "华东", "芜湖": "华东", "蚌埠": "华东", "淮南": "华东", "马鞍山": "华东", "淮北": "华东", "铜陵": "华东", "安庆": "华东", "黄山": "华东", "滁州": "华东", "阜阳": "华东", "宿州": "华东", "六安": "华东", "亳州": "华东", "池州": "华东", "宣城": "华东", "厦门": "华东", "莆田": "华东", "三明": "华东", "泉州": "华东", "漳州": "华东", "南平": "华东", "龙岩": "华东", "宁德": "华东", "景德镇": "华东", "萍乡": "华东", "九江": "华东", "新余": "华东", "鹰潭": "华东", "赣州": "华东", "吉安": "华东", "宜春": "华东", "抚州": "华东", "上饶": "华东", "青岛": "华东", "淄博": "华东", "枣庄": "华东", "东营": "华东", "烟台": "华东", "潍坊": "华东", "济宁": "华东", "泰安": "华东", "威海": "华东", "日照": "华东", "临沂": "华东", "德州": "华东", "聊城": "华东", "滨州": "华东", "菏泽": "华东",
        "广州": "华南", "南宁": "华南", "海口": "华南", "深圳": "华南", "珠海": "华南", "汕头": "华南", "佛山": "华南", "江门": "华南", "湛江": "华南", "茂名": "华南", "肇庆": "华南", "惠州": "华南", "梅州": "华南", "汕尾": "华南", "河源": "华南", "阳江": "华南", "清远": "华南", "东莞": "华南", "中山": "华南", "潮州": "华南", "揭阳": "华南", "云浮": "华南", "柳州": "华南", "桂林": "华南", "梧州": "华南", "北海": "华南", "防城港": "华南", "钦州": "华南", "贵港": "华南", "玉林": "华南", "百色": "华南", "贺州": "华南", "河池": "华南", "来宾": "华南", "崇左": "华南", "三亚": "华南", "三沙": "华南", "儋州": "华南",
        "武汉": "华中", "长沙": "华中", "郑州": "华中", "黄石": "华中", "十堰": "华中", "宜昌": "华中", "襄阳": "华中", "鄂州": "华中", "荆门": "华中", "孝感": "华中", "荆州": "华中", "黄冈": "华中", "咸宁": "华中", "随州": "华中", "恩施": "华中", "株洲": "华中", "湘潭": "华中", "衡阳": "华中", "邵阳": "华中", "岳阳": "华中", "常德": "华中", "张家界": "华中", "益阳": "华中", "郴州": "华中", "永州": "华中", "怀化": "华中", "娄底": "华中", "开封": "华中", "洛阳": "华中", "平顶山": "华中", "安阳": "华中", "鹤壁": "华中", "新乡": "华中", "焦作": "华中", "濮阳": "华中", "许昌": "华中", "漯河": "华中", "三门峡": "华中", "南阳": "华中", "商丘": "华中", "信阳": "华中", "周口": "华中", "驻马店": "华中",
        "重庆": "西南", "成都": "西南", "贵阳": "西南", "昆明": "西南", "拉萨": "西南", "自贡": "西南", "攀枝花": "西南", "泸州": "西南", "德阳": "西南", "绵阳": "西南", "广元": "西南", "遂宁": "西南", "内江": "西南", "乐山": "西南", "南充": "西南", "眉山": "西南", "宜宾": "西南", "广安": "西南", "达州": "西南", "雅安": "西南", "巴中": "西南", "资阳": "西南", "六盘水": "西南", "遵义": "西南", "安顺": "西南", "毕节": "西南", "铜仁": "西南", "曲靖": "西南", "玉溪": "西南", "保山": "西南", "昭通": "西南", "丽江": "西南", "普洱": "西南", "临沧": "西南",
        "西安": "西北", "兰州": "西北", "西宁": "西北", "银川": "西北", "乌鲁木齐": "西北", "铜川": "西北", "宝鸡": "西北", "咸阳": "西北", "渭南": "西北", "延安": "西北", "汉中": "西北", "榆林": "西北", "安康": "西北", "商洛": "西北", "嘉峪关": "西北", "金昌": "西北", "白银": "西北", "天水": "西北", "武威": "西北", "张掖": "西北", "平凉": "西北", "酒泉": "西北", "庆阳": "西北", "定西": "西北", "陇南": "西北", "石嘴山": "西北", "吴忠": "西北", "固原": "西北", "中卫": "西北", "克拉玛依": "西北"
    };
  }

  /**
   * 初始化：加载基础配置数据 (类型、城市坐标、地图边界)
   * [修改] 增加了详细的调试日志和错误弹窗，用于排查地图加载失败的问题
   */
  async init() {
    console.log("🚀 DataManager: 开始加载基础数据...");
    try {
      // 1. 加载污染物类型
      const types = await d3.csv(CONFIG.typeURL);
      this.pollutants = types.map(d => Object.values(d)[0].trim()).filter(item => item);
      if (this.pollutants.length === 0) this.pollutants = ["AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3"];
      console.log("✅ 污染物类型加载成功");

      // 2. 加载城市坐标
      const coords = await d3.csv(CONFIG.cityURL);
      coords.forEach(d => { this.cityCoords[d.City] = [+d.Longtitude, +d.Latitude]; });
      console.log("✅ 城市坐标加载成功");
      
      // 3. 重点调试：加载地图
      console.log(`🌍 正在尝试从 [${CONFIG.mapURL}] 加载地图...`);
      this.geoJSON = await d3.json(CONFIG.mapURL);
      
      if (!this.geoJSON) {
          throw new Error("china.json 加载结果为空！");
      }
      console.log("✅ 地图数据加载成功！Feature数量:", this.geoJSON.features.length);

    } catch (e) {
      console.error("❌ 基础数据加载惨败:", e);
      // 弹窗提示用户
      alert("严重错误：地图文件加载失败！\n\n请按 F12 打开浏览器控制台查看具体错误原因。\n通常是因为 'china.json' 文件未放在 'data' 目录下。");
    }
  }

  /**
   * 加载所有核心污染物数据
   * 并筛选出 2025 年的数据缓存到 this.datasets
   */
  async loadAllData() {
    console.log("开始加载详细污染物数据...");
    
    const loadPromises = Object.keys(CONFIG.pollutantFiles).map(async (type) => {
        this.detailedDatasets[type] = {};
        const metrics = CONFIG.pollutantFiles[type];
        
        const metricPromises = Object.keys(metrics).map(async (metric) => {
            const url = metrics[metric];
            try {
                const data = await d3.csv(url);
                const cleanData = data.filter(d => d.date); 
                
                this.detailedDatasets[type][metric] = cleanData;
                
                // 默认使用 mean 数据作为主数据，如果没有则使用 max
                if (metric === 'mean' || (metric === 'max' && !this.datasets[type])) {
                    const filteredData = cleanData.filter(d => {
                        const dateObj = new Date(d.date);
                        return dateObj.getFullYear() >= 2025;
                    });
                    this.datasets[type] = filteredData;
                }
            } catch (err) {
                console.warn(`加载失败: ${type} - ${metric}`, err);
                this.detailedDatasets[type][metric] = [];
            }
        });
        await Promise.all(metricPromises);
    });

    await Promise.all(loadPromises);
    this.filterValidCities();
    console.log("✅ 数据加载完毕");
  }

  /**
   * 获取指定城市 2025 年的全年数据
   * @param {string} city 城市名
   * @param {string} pollutant 污染物类型
   * @param {string} metric 数据类型 (max/mean/min)
   */
  getCity2025Data(city, pollutant, metric = 'max') {
      if (this.detailedDatasets[pollutant] && this.detailedDatasets[pollutant][metric]) {
          const raw = this.detailedDatasets[pollutant][metric];
          return raw
            .filter(d => {
                const date = new Date(d.date);
                return date.getFullYear() === 2025; 
            })
            .map(d => ({
                date: new Date(d.date),
                value: parseFloat(d[city])
            }))
            .filter(d => !isNaN(d.value)); 
      }
      return [];
  }

  /**
   * 计算某个月份的全国平均日数据
   * @param {string} pollutant 
   * @param {number} monthIndex (0-11)
   */
  getNationalMonthData(pollutant, monthIndex) {
      const dataset = this.datasets[pollutant]; 
      if (!dataset) return [];
      
      const startDay = this.getIndexFromDate(monthIndex + 1, 1);
      const daysCount = this.daysInMonth[monthIndex];
      const endDay = startDay + daysCount;
      
      const result = [];
      
      for (let i = startDay; i < endDay; i++) {
          if (i >= dataset.length) break;
          const row = dataset[i];
          let sum = 0;
          let count = 0;
          
          this.validCities.forEach(city => {
              const val = parseFloat(row[city]);
              if (!isNaN(val)) {
                  sum += val;
                  count++;
              }
          });
          
          if (count > 0) {
              result.push({
                  date: new Date(row.date),
                  value: sum / count
              });
          }
      }
      return result;
  }

  /**
   * 获取 2025 年全国每日平均值序列
   */
  getNationalDailyMean(pollutant) {
      const dataset = this.datasets[pollutant]; 
      if (!dataset || dataset.length === 0) return [];
      
      const result = [];
      
      dataset.forEach(row => {
          if (!row.date) return;
          const date = new Date(row.date);
          if (date.getFullYear() !== 2025) return;

          let sum = 0;
          let count = 0;
          this.validCities.forEach(city => {
              const val = parseFloat(row[city]);
              if (!isNaN(val)) {
                  sum += val;
                  count++;
              }
          });

          if (count > 0) {
              result.push({
                  date: date,
                  value: sum / count
              });
          }
      });
      return result;
  }

  getCityRegion(city) {
      return this.cityRegionMap[city] || "华北";
  }

  /**
   * 筛选有效城市 (即在数据集中有值的城市)
   */
  filterValidCities() {
    const allCities = Object.keys(this.cityCoords);
    const validSet = new Set();
    const aqiData = this.datasets['AQI'];
    if (!aqiData || aqiData.length === 0) { this.validCities = allCities; return; }
    
    // 采样前50天数据检查该城市是否有值
    const sampleSize = Math.min(aqiData.length, 50);
    allCities.forEach(city => {
      let hasData = false;
      for (let i = 0; i < sampleSize; i++) {
        if (parseFloat(aqiData[i][city])) { hasData = true; break; }
      }
      if (hasData) validSet.add(city);
    });
    this.validCities = Array.from(validSet);
  }

  /**
   * 根据日期获取数据索引 (0-364)
   */
  getIndexFromDate(month, day) {
    let index = 0;
    for (let i = 0; i < month - 1; i++) { index += this.daysInMonth[i]; }
    index += day - 1;
    if (this.datasets['AQI']) {
        const maxLen = this.datasets['AQI'].length;
        if (index >= maxLen) index = maxLen - 1;
    }
    return index;
  }

  /**
   * 获取某一天所有城市的污染物数据 (用于地图热力)
   */
  getDailyMapData(dateIndex, pollutant) {
    const dataset = this.datasets[pollutant]; 
    const dataMap = {};
    if (dataset && dataset[dateIndex]) {
      const row = dataset[dateIndex];
      this.validCities.forEach(city => {
        const val = parseFloat(row[city]);
        if (!isNaN(val)) { dataMap[city] = val; }
      });
    }
    return dataMap;
  }

  /**
   * 获取某天某城市的雷达图数据
   */
  getRadarData(city, dateIndex) {
    const radarData = [];
    this.pollutants.forEach(type => {
      const dataset = this.datasets[type];
      if (dataset && dataset[dateIndex] && dataset[dateIndex][city] !== undefined) {
        const value = parseFloat(dataset[dateIndex][city]); 
        
        // 归一化处理
        let maxVal = 200; 
        if (type === 'CO') maxVal = 5;
        if (type === 'AQI') maxVal = 300;
        if (type === 'SO2') maxVal = 100;
        
        let normalized = value / maxVal;
        if (normalized > 1) normalized = 1;
        radarData.push({ axis: type, value: normalized || 0, originalValue: value });
      }
    });
    return [radarData];
  }

  /**
   * 获取某天全国均值的雷达图数据
   */
  getNationalRadarData(dateIndex) {
    const radarData = [];
    this.pollutants.forEach(type => {
      const dataset = this.datasets[type];
      if (dataset && dataset[dateIndex]) {
          const row = dataset[dateIndex];
          let sum = 0; 
          let count = 0;
          this.validCities.forEach(city => {
              const val = parseFloat(row[city]);
              if (!isNaN(val)) {
                  sum += val;
                  count++;
              }
          });
          const avgValue = count > 0 ? sum / count : 0;

          let maxVal = 200; 
          if (type === 'CO') maxVal = 5;
          if (type === 'AQI') maxVal = 300;
          if (type === 'SO2') maxVal = 100;

          let normalized = avgValue / maxVal;
          if (normalized > 1) normalized = 1;
          radarData.push({ axis: type, value: normalized || 0, originalValue: avgValue });
      }
    });
    return [radarData];
  }

  getDateString(type, index) {
      if(this.datasets[type] && this.datasets[type][index]) {
          return this.datasets[type][index]['date'];
      }
      return "";
  }
  
  getValue(type, index, city) {
      if(this.datasets[type] && this.datasets[type][index]) {
          return this.datasets[type][index][city];
      }
      return "-";
  }
}