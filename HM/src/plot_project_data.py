"""
Vẽ phân phối dữ liệu cho bài toán Project Delay (Random Forest).
"""
from __future__ import annotations

from pathlib import Path
import matplotlib.pyplot as plt
import pandas as pd

from src.utils import DATA_DIR, OUTPUT_DIR, ensure_dirs

def plot_project_distributions(output_name: str = "project_data_distributions.png") -> Path:
    ensure_dirs()
    path = DATA_DIR / "projects_mock.csv"
    
    if not path.exists():
        print(f"[plot_project_data] Không tìm thấy {path}")
        return None

    df = pd.read_csv(path)
    
    # Tạo hình ảnh có 4 biểu đồ con (2x2)
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle("Phân phối dữ liệu Dự án (Project Mock Data)", fontsize=16)

    # 1. Phân phối Delay Risk Level (0: Low, 1: Medium, 2: High)
    risk_counts = df["delay_risk_level"].value_counts().sort_index()
    axes[0, 0].bar(risk_counts.index.astype(str), risk_counts.values, color=["#66c2a5", "#fc8d62", "#8da0cb"])
    axes[0, 0].set_title("Delay Risk Level (0=Low, 1=Medium, 2=High)")
    axes[0, 0].set_xlabel("Mức độ rủi ro")
    axes[0, 0].set_ylabel("Số lượng dự án")

    # 2. Phân phối Elapsed Time Ratio
    axes[0, 1].hist(df["elapsed_time_ratio"], bins=30, color="coral", edgecolor="white", alpha=0.85)
    axes[0, 1].set_title("Phân phối Elapsed Time Ratio")
    axes[0, 1].set_xlabel("Tỉ lệ thời gian đã trôi qua")
    axes[0, 1].set_ylabel("Count")

    # 3. Phân phối Task Completion Ratio
    axes[1, 0].hist(df["task_completion_ratio"], bins=30, color="mediumseagreen", edgecolor="white", alpha=0.85)
    axes[1, 0].set_title("Phân phối Task Completion Ratio")
    axes[1, 0].set_xlabel("Tỉ lệ hoàn thành công việc")
    axes[1, 0].set_ylabel("Count")

    # 4. Boxplot: Overdue Tasks Count theo Risk Level
    data_by_risk = [df[df["delay_risk_level"] == 0]["overdue_tasks_count"], 
                    df[df["delay_risk_level"] == 1]["overdue_tasks_count"],
                    df[df["delay_risk_level"] == 2]["overdue_tasks_count"]]
    axes[1, 1].boxplot(data_by_risk, tick_labels=["0", "1", "2"])
    axes[1, 1].set_title("Số task quá hạn theo Mức độ rủi ro")
    axes[1, 1].set_xlabel("Mức độ rủi ro")
    axes[1, 1].set_ylabel("Số task quá hạn")

    fig.tight_layout()
    out = OUTPUT_DIR / output_name
    fig.savefig(out, dpi=120, bbox_inches="tight")
    plt.close(fig)
    print(f"[plot_project_data] Đã lưu biểu đồ → {out}")
    return out

if __name__ == "__main__":
    plot_project_distributions()
