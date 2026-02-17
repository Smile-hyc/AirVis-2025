import pandas as pd
import os

# ================= 配置区域 =================
# 数据目录 (直接读取生成的日级数据，并把月级数据也存在这里)
DATA_DIR = './data'

# 污染物列表
POLLUTANTS = ['AQI', 'PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3']

# 统计类型 (对应 daymean, daymax, daymin)
STATS_TYPES = ['mean', 'max', 'min']
# ===========================================

def process_monthly():
    print("🚀 开始生成月度数据 (Month Data)...")
    
    count = 0
    
    for pollutant in POLLUTANTS:
        for stat in STATS_TYPES:
            # 1. 构造输入文件名 (例如 AQI_daymean.csv)
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
                # 提取月份，变成 '2021-01' 格式
                df['month'] = df['date'].dt.to_period('M')
                
                # 4. 按月份分组计算
                # 去掉原来的 date 列，改用 month 分组
                # numeric_only=True 确保只计算数值列(城市数据)
                if stat == 'mean':
                    monthly_df = df.drop(columns=['date']).groupby('month').mean(numeric_only=True)
                    # 平均值通常保留1位小数比较好看
                    monthly_df = monthly_df.round(1)
                elif stat == 'max':
                    monthly_df = df.drop(columns=['date']).groupby('month').max(numeric_only=True)
                elif stat == 'min':
                    monthly_df = df.drop(columns=['date']).groupby('month').min(numeric_only=True)
                
                # 5. 保存结果
                # 生成文件名: AQI_monthmean.csv
                output_file = f"{pollutant}_month{stat}.csv"
                output_path = os.path.join(DATA_DIR, output_file)
                
                # 这里的 index=True 会把 month 列作为第一列写入 CSV
                monthly_df.to_csv(output_path, index=True, encoding='utf-8')
                
                print(f"生成: {output_file}")
                count += 1
                
            except Exception as e:
                print(f"处理 {input_file} 失败: {e}")

    print(f"\n月度数据生成完毕！共 {count} 个文件。")

if __name__ == '__main__':
    process_monthly()