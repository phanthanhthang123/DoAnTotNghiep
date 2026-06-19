"""
CLI bridge: Nhận JSON từ stdin, gọi predict_project_delay, trả JSON ra stdout.
Dùng cho Node.js gọi qua child_process.

Nâng cấp: 
  - Tính avg_member_kpi bằng công thức: (kpi_A * 1 + kpi_B * 2) / 3
  - Trả thêm accuracy, confusion_matrix, classification_report, cross-validation.

Cách dùng:
    echo '{"project": {...}, "members": [...]}' | python -m src.predict_project_cli
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from src.predict import (
    ProjectInput,
    UserOnboardingInput,
    UserInternalInput,
    predict_project_delay,
    predict_kpi_onboarding,
    predict_kpi_internal,
)


def compute_weighted_kpi(members_data: list[dict]) -> tuple[float, list[dict]]:
    """
    Tính avg_member_kpi bằng công thức có trọng số dựa theo vai trò (Role):
    - Dữ liệu KPI cá nhân đã được tính sẵn khi tạo account (truyền vào qua kpi)
    - Hệ số ảnh hưởng tới Dự Án (Impact Weight):
      + Leader/PM: x2.0
      + Manager: x1.5
      + Intern: x0.5
      + Member: x1.0
    """
    if not members_data:
        return 0.5, []

    total_weighted_kpi = 0.0
    total_impact_weight = 0.0
    member_details = []

    for m in members_data:
        kpi_val = float(m.get("kpi", 0.5))
        role = str(m.get("role", "Member")).strip().lower()

        # ── Hệ số ảnh hưởng tới Dự Án (Impact Weight) ──
        if role in ["leader", "project manager", "pm", "admin", "kleader"]:
            impact_weight = 2.0  # Ảnh hưởng x2
        elif role in ["sub-leader", "manager", "tech lead"]:
            impact_weight = 1.5  # Ảnh hưởng x1.5
        elif role in ["intern", "fresher", "trainee"]:
            impact_weight = 0.5  # Ảnh hưởng x0.5
        else:
            impact_weight = 1.0  # Member bình thường x1

        total_weighted_kpi += kpi_val * impact_weight
        total_impact_weight += impact_weight

        member_details.append({
            "user_id": m.get("user_id", "unknown"),
            "role": m.get("role", "Member"),
            "kpi": round(kpi_val, 4),
            "impact_weight": impact_weight
        })

    avg_kpi = total_weighted_kpi / total_impact_weight if total_impact_weight > 0 else 0.5
    return round(avg_kpi, 4), member_details


def main() -> None:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)

        project_data = data["project"]
        members_data = data.get("members", [])

        # ── Tính avg_member_kpi bằng weighted formula ──
        avg_member_kpi, member_kpi_details = compute_weighted_kpi(members_data)

        project = ProjectInput(
            team_size=int(project_data["team_size"]),
            planned_duration_days=int(project_data["planned_duration_days"]),
            total_tasks=int(project_data["total_tasks"]),
            remaining_hard_tasks=int(project_data["remaining_hard_tasks"]),
            remaining_high_priority_tasks=int(project_data["remaining_high_priority_tasks"]),
            elapsed_time_ratio=float(project_data["elapsed_time_ratio"]),
            task_completion_ratio=float(project_data["task_completion_ratio"]),
            overdue_tasks_count=int(project_data["overdue_tasks_count"]),
            avg_member_kpi=avg_member_kpi,  # Dùng weighted KPI thay vì avg từ DB
        )

        risk_level, top_reasons, model_metrics = predict_project_delay(project)

        result = {
            "risk_level": risk_level,
            "top_reasons": [
                {"feature": feat, "importance": round(imp, 4)}
                for feat, imp in top_reasons
            ],
            "model_evaluation": model_metrics,
            "kpi_calculation": {
                "formula": "(kpi_model_A * 1 + kpi_model_B * 2) / 3",
                "avg_member_kpi": avg_member_kpi,
                "member_details": member_kpi_details,
            },
        }

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        error_result = {"error": str(e)}
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
