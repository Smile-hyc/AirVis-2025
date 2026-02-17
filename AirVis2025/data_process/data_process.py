import pandas as pd
import os
import glob
import time

# ================= 配置区域 =================
RAW_DATA_DIR = './data/raw'  # 原始数据目录
OUTPUT_DIR = './data'        # 输出目录
POLLUTANTS = ['AQI', 'PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3']
# ===========================================

def process_air_data():
    start_time = time.time()
    
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # 获取文件列表
    search_pattern = os.path.join(RAW_DATA_DIR, 'china_cities_*.csv')
    csv_files = glob.glob(search_pattern)
    csv_files.sort()

    if not csv_files:
        print(f"错误：在 {RAW_DATA_DIR} 没找到 china_cities_*.csv 文件！")
        return

    print(f"找到 {len(csv_files)} 个文件，准备生成 [Mean, Max, Min] 三种数据...")

    # 数据存储仓库：结构变得更复杂一点
    # store['AQI']['mean'] = [...]
    # store['AQI']['max'] = [...]
    data_store = {
        p: {'mean': [], 'max': [], 'min': []} 
        for p in POLLUTANTS
    }

    # 逐天处理
    for i, file_path in enumerate(csv_files):
        try:
            df = pd.read_csv(file_path, encoding='utf-8')
            
            # 提取日期
            filename = os.path.basename(file_path)
            date_part = filename.split('_')[2].split('.')[0]
            formatted_date = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:]}"

            for pollutant in POLLUTANTS:
                subset = df[df['type'] == pollutant]
                if subset.empty: continue

                # 提取城市数据列
                city_data = subset.iloc[:, 3:] 

                # 【升级点】同时计算三种统计值
                stats = {
                    'mean': city_data.mean(numeric_only=True),
                    'max':  city_data.max(numeric_only=True),
                    'min':  city_data.min(numeric_only=True)
                }

                # 存入对应列表
                for stat_type, series in stats.items():
                    row = series.to_frame().T
                    row.insert(0, 'date', formatted_date)
                    data_store[pollutant][stat_type].append(row)
            
            if (i + 1) % 100 == 0:
                print(f"已处理 {i + 1} / {len(csv_files)} 天...")

        except Exception as e:
            print(f"文件 {filename} 出错: {e}")

    # 保存文件
    print("\n正在保存所有 CSV...")
    count = 0
    
    # 遍历每种污染物 (AQI...)
    for pollutant in POLLUTANTS:
        # 遍历每种统计类型 (mean, max, min)
        for stat_type in ['mean', 'max', 'min']:
            rows = data_store[pollutant][stat_type]
            
            if rows:
                final_df = pd.concat(rows, ignore_index=True)
                
                # 文件名格式：AQI_daymean.csv, AQI_daymax.csv ...
                filename = f"{pollutant}_day{stat_type}.csv"
                output_path = os.path.join(OUTPUT_DIR, filename)
                
                final_df.to_csv(output_path, index=False, encoding='utf-8')
                print(f"生成: {filename}")
                count += 1

    print(f"\n大功告成！共生成 {count} 个文件。")
    print(f"总耗时: {time.time() - start_time:.2f} 秒")

if __name__ == '__main__':
    process_air_data()