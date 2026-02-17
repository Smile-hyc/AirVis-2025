import pandas as pd
import os

# ================= 配置区域 =================
# 数据目录 (读取生成的日级数据)
DATA_DIR = './data'

# 污染物列表
POLLUTANTS = ['AQI', 'PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3']

# 统计类型
STATS_TYPES = ['mean', 'max', 'min']
# ===========================================

def process_yearly():
    print("开始生成年度数据 (Year Data)...")
    
    count = 0
    
    for pollutant in POLLUTANTS:
        for stat in STATS_TYPES:
            # 1. 构造输入文件名 (读取日级数据作为源)
            # 例如: 读取 AQI_daymean.csv 来计算 AQI_yearmean.csv
            # 例如: 读取 AQI_daymax.csv 来计算 AQI_yearmax.csv
            input_file = f"{pollutant}_day{stat}.csv"
            input_path = os.path.join(DATA_DIR, input_file)
            
            # 检查文件是否存在
            if not os.path.exists(input_path):
                print(f"跳过: 找不到 {input_file}")
                continue
                
            try:
                # 2. 读取日级数据
                df = pd.read_csv(input_path, encoding='utf-8')
                
                # 3. 处理日期列
                # 把 '2021-01-01' 转换成时间对象
                df['date'] = pd.to_datetime(df['date'])
                
                # 提取年份，作为分组依据
                df['year'] = df['date'].dt.year
                
                # 4. 按年份分组计算
                # 逻辑:
                # - 如果算年均值(mean)，就对日均值求平均
                # - 如果算年最大值(max)，就取日最大值里的最大值
                # - 如果算年最小值(min)，就取日最小值里的最小值
                if stat == 'mean':
                    yearly_df = df.drop(columns=['date']).groupby('year').mean(numeric_only=True)
                    yearly_df = yearly_df.round(1) # 保留1位小数
                elif stat == 'max':
                    yearly_df = df.drop(columns=['date']).groupby('year').max(numeric_only=True)
                elif stat == 'min':
                    yearly_df = df.drop(columns=['date']).groupby('year').min(numeric_only=True)
                
                # 5. 保存结果
                # 生成文件名: AQI_yearmean.csv
                output_file = f"{pollutant}_year{stat}.csv"
                output_path = os.path.join(DATA_DIR, output_file)
                
                # index=True 会把 year 列作为第一列写入
                yearly_df.to_csv(output_path, index=True, encoding='utf-8')
                
                print(f"生成: {output_file}")
                count += 1
                
            except Exception as e:
                print(f"处理 {input_file} 失败: {e}")

    print(f"\n年度数据生成完毕！共 {count} 个文件。")

if __name__ == '__main__':
    process_yearly()