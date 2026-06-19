"""
Tạo dữ liệu mock cho bài toán dự đoán trễ tiến độ dự án (Random Forest).
"""
import pandas as pd
import numpy as np
from pathlib import Path
from src.utils import ensure_dirs, ROOT_DIR

def generate_project_data(num_samples: int = 2000, force: bool = False) -> None:
    ensure_dirs()
    out_path = ROOT_DIR / "data" / "projects_mock.csv"
    if out_path.exists() and not force:
        print(f"[generate_project_data] File đã tồn tại: {out_path}. Bỏ qua.")
        return

    np.random.seed(42)
    
    # 1. Sinh features
    team_size = np.random.randint(1, 15, size=num_samples)
    planned_duration_days = np.random.randint(14, 180, size=num_samples)
    total_tasks = np.random.randint(10, 300, size=num_samples)
    
    # Tỉ lệ task hoàn thành và thời gian trôi qua
    elapsed_time_ratio = np.random.uniform(0.1, 1.2, size=num_samples)
    task_completion_ratio = np.random.uniform(0.1, 1.0, size=num_samples)
    
    # Số task khó và quan trọng còn lại
    remaining_hard_tasks = (total_tasks * np.random.uniform(0.0, 0.3, size=num_samples)).astype(int)
    remaining_high_priority_tasks = (total_tasks * np.random.uniform(0.0, 0.3, size=num_samples)).astype(int)
    
    # Task quá hạn (liên quan đến thời gian và tiến độ)
    overdue_tasks_count = (total_tasks * np.random.uniform(0.0, 0.2, size=num_samples)).astype(int)
    
    # KPI trung bình của team (giả định dùng Model B)
    avg_member_kpi = np.random.uniform(0.5, 1.0, size=num_samples)
    
    # 2. Sinh nhãn (Target: delay_risk_level)
    # 0 = Low, 1 = Medium, 2 = High
    delay_risk_level = np.zeros(num_samples, dtype=int)
    
    for i in range(num_samples):
        score = 0.0
        
        # Chậm tiến độ so với thời gian
        if elapsed_time_ratio[i] > 0.8 and task_completion_ratio[i] < 0.6:
            score += 2
        elif elapsed_time_ratio[i] > 0.5 and task_completion_ratio[i] < 0.4:
            score += 1
            
        # Nhiều task khó/ưu tiên cao còn lại khi sắp hết hạn
        if elapsed_time_ratio[i] > 0.7:
            if remaining_hard_tasks[i] / total_tasks[i] > 0.15:
                score += 1.5
            if remaining_high_priority_tasks[i] / total_tasks[i] > 0.15:
                score += 1
                
        # Quá hạn nhiều
        if overdue_tasks_count[i] / total_tasks[i] > 0.1:
            score += 2
            
        # KPI team thấp
        if avg_member_kpi[i] < 0.7:
            score += 1
            
        # Gán nhãn dựa trên score
        if score >= 3:
            delay_risk_level[i] = 2 # High
        elif score >= 1.5:
            delay_risk_level[i] = 1 # Medium
        else:
            delay_risk_level[i] = 0 # Low

    # 3. Tạo DataFrame
    df = pd.DataFrame({
        "team_size": team_size,
        "planned_duration_days": planned_duration_days,
        "total_tasks": total_tasks,
        "remaining_hard_tasks": remaining_hard_tasks,
        "remaining_high_priority_tasks": remaining_high_priority_tasks,
        "elapsed_time_ratio": np.round(elapsed_time_ratio, 2),
        "task_completion_ratio": np.round(task_completion_ratio, 2),
        "overdue_tasks_count": overdue_tasks_count,
        "avg_member_kpi": np.round(avg_member_kpi, 2),
        "delay_risk_level": delay_risk_level
    })
    
    df.to_csv(out_path, index=False)
    print(f"[generate_project_data] Đã tạo {num_samples} dòng dữ liệu mẫu tại {out_path}")

if __name__ == "__main__":
    generate_project_data(force=True)
