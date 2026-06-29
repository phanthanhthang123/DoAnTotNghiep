"""
Chọn model theo ngữ cảnh user và trả về KPI score.

- User mới / chưa có dữ liệu nội bộ → Model A (onboarding): CPA + interview + CV + num_projects + years_experience
- User đã làm việc trong hệ thống → Model B (nội bộ): projects / tasks / hard_tasks / years_at_company

Thang đầu ra:
- Model A: [0, KPI_MAX_ONBOARDING] (mặc định 0.9)
- Model B: [0, KPI_MAX_INTERNAL] (1.0)
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import joblib
import numpy as np
import pandas as pd

from src.utils import KPI_MAX_INTERNAL, KPI_MAX_ONBOARDING, model_path, ROOT_DIR


@dataclass
class UserOnboardingInput:
    """Dữ liệu khi tạo account (Model A)."""

    cpa: float
    interview_score: float
    cv_score: float
    years_experience: float
    num_projects: float


@dataclass
class UserInternalInput:
    """Dữ liệu nội bộ (Model B)."""

    total_projects: int
    total_tasks: int
    hard_tasks: int
    years_at_company: float


@dataclass
class ProjectInput:
    """Dữ liệu dự án (Mô hình Random Forest)."""

    team_size: int
    planned_duration_days: int
    total_tasks: int
    remaining_hard_tasks: int
    remaining_high_priority_tasks: int
    elapsed_time_ratio: float
    task_completion_ratio: float
    overdue_tasks_count: int
    avg_member_kpi: float


def _load_bundle(model_key: str) -> dict[str, Any]:
    p = model_path(model_key)
    if not p.exists():
        raise FileNotFoundError(f"Chưa có model {model_key}: {p}. Hãy train trước.")
    return joblib.load(p)


def _proba_positive(pipe, X: np.ndarray) -> float:
    proba = pipe.predict_proba(X)
    return float(np.clip(proba[0, 1], 0.0, 1.0))


def scale_kpi_to_business_range(raw_proba: float, model_key: str) -> float:
    p = float(np.clip(raw_proba, 0.0, 1.0))
    if model_key == "A":
        return float(np.round(KPI_MAX_ONBOARDING * p, 6))
    if model_key == "B":
        return float(np.round(KPI_MAX_INTERNAL * p, 6))
    raise ValueError(f"model_key không hợp lệ: {model_key}")


def select_model_key(is_internal_employee: bool) -> str:
    return "B" if is_internal_employee else "A"


def predict_kpi_onboarding(user: UserOnboardingInput) -> tuple[float, str]:
    """KPI lúc tạo account — luôn Model A (vector đầy đủ onboarding)."""
    bundle = _load_bundle("A")
    pipe = bundle["pipeline"]
    vec = np.array(
        [
            [
                user.cpa,
                user.interview_score,
                user.cv_score,
                user.num_projects,
                user.years_experience,
            ]
        ],
        dtype=float,
    )
    raw = _proba_positive(pipe, vec)
    score = scale_kpi_to_business_range(raw, "A")
    return score, "A"


def predict_kpi_internal(user: UserInternalInput) -> tuple[float, str]:
    bundle = _load_bundle("B")
    pipe = bundle["pipeline"]
    vec = np.array(
        [
            [
                user.total_projects,
                user.total_tasks,
                user.hard_tasks,
                user.years_at_company,
            ]
        ],
        dtype=float,
    )
    raw = _proba_positive(pipe, vec)
    score = scale_kpi_to_business_range(raw, "B")
    return score, "B"


def predict_kpi_full(
    *,
    is_internal_employee: bool,
    onboarding: UserOnboardingInput | None = None,
    internal: UserInternalInput | None = None,
) -> tuple[float, str]:
    key = select_model_key(is_internal_employee)
    if key == "B":
        if internal is None:
            raise ValueError("Model B cần UserInternalInput (internal=...).")
        return predict_kpi_internal(internal)
    if onboarding is None:
        raise ValueError("Model A cần UserOnboardingInput (onboarding=...).")
    return predict_kpi_onboarding(onboarding)


def predict_project_delay(
    project: ProjectInput
) -> tuple[str, list[tuple[str, float]], dict]:
    """
    Dự đoán trễ tiến độ dự án bằng Random Forest.
    Sử dụng avg_member_kpi được truyền vào từ project data.

    Returns:
        (risk_label, top_reasons, model_metrics)
        - risk_label: "Low" | "Medium" | "High"
        - top_reasons: top 3 feature importances
        - model_metrics: dict chứa accuracy, confusion_matrix, classification_report, cv, ...
    """
    avg_member_kpi = project.avg_member_kpi

    # 1. Load RF model
    p = ROOT_DIR / "models" / "rf_project_delay.pkl"
    if not p.exists():
        raise FileNotFoundError(f"Chưa có model RF tại {p}. Hãy chạy train_model_rf.py trước.")
    
    bundle = joblib.load(p)
    rf_model = bundle["model"]
    feature_cols = bundle["feature_columns"]

    # 2. Tạo DataFrame đầu vào với tên cột khớp với lúc train (tránh UserWarning)
    vec = pd.DataFrame([[
        project.team_size,
        project.planned_duration_days,
        project.total_tasks,
        project.remaining_hard_tasks,
        project.remaining_high_priority_tasks,
        project.elapsed_time_ratio,
        project.task_completion_ratio,
        project.overdue_tasks_count,
        avg_member_kpi
    ]], columns=feature_cols, dtype=float)

    # 3. Dự đoán + xác suất từng class
    risk_idx = rf_model.predict(vec)[0]
    risk_proba = rf_model.predict_proba(vec)[0]  # xác suất cho từng class
    risk_map = {0: "Low", 1: "Medium", 2: "High"}
    risk_label = risk_map.get(risk_idx, "Unknown")

    # 4. Phân tích Feature Importances
    importances = bundle["feature_importances"]

    # 5. Lấy metrics đánh giá mô hình từ bundle
    class_labels = bundle.get("class_labels", ["Low", "Medium", "High"])
    cls_report = bundle.get("classification_report", {})

    # Xây dựng per-class metrics dạng list cho frontend
    per_class = []
    for label in class_labels:
        info = cls_report.get(label, {})
        per_class.append({
            "label": label,
            "precision": round(info.get("precision", 0), 4),
            "recall": round(info.get("recall", 0), 4),
            "f1_score": round(info.get("f1-score", 0), 4),
            "support": int(info.get("support", 0)),
        })

    model_metrics = {
        "accuracy": round(bundle.get("accuracy", 0), 4),
        "confusion_matrix": bundle.get("confusion_matrix", []),
        "class_labels": class_labels,
        "per_class_metrics": per_class,
        # Cross-Validation
        "cv_accuracy_mean": round(bundle.get("cv_accuracy_mean", 0), 4),
        "cv_accuracy_std": round(bundle.get("cv_accuracy_std", 0), 4),
        "cv_scores": [round(s, 4) for s in bundle.get("cv_scores", [])],
        # Macro & Weighted averages
        "precision_macro": round(bundle.get("precision_macro", 0), 4),
        "recall_macro": round(bundle.get("recall_macro", 0), 4),
        "f1_macro": round(bundle.get("f1_macro", 0), 4),
        "precision_weighted": round(bundle.get("precision_weighted", 0), 4),
        "recall_weighted": round(bundle.get("recall_weighted", 0), 4),
        "f1_weighted": round(bundle.get("f1_weighted", 0), 4),
        # Dataset info
        "test_size": bundle.get("test_size", 0),
        "train_size": bundle.get("train_size", 0),
        "total_samples": bundle.get("total_samples", 0),
        # Prediction confidence cho lần dự đoán này
        "prediction_confidence": {
            "probabilities": {
                risk_map[i]: round(float(risk_proba[i]), 4)
                for i in range(len(risk_proba))
            },
            "predicted_class": risk_label,
            "confidence_percent": round(float(max(risk_proba)) * 100, 2),
        },
    }
    
    return risk_label, importances[:3], model_metrics
