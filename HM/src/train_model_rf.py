"""
Huấn luyện mô hình Random Forest cho dự đoán rủi ro trễ dự án.
Nâng cấp: Hyperparameter tuning, Cross-Validation, lưu Confusion Matrix + Accuracy + Classification Report.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)
import joblib

from src.utils import ROOT_DIR


def train_rf() -> None:
    data_path = ROOT_DIR / "data" / "projects_mock.csv"
    if not data_path.exists():
        print(f"[train_rf] Không tìm thấy file {data_path}. Hãy chạy generate_project_data.py trước.")
        return

    df = pd.read_csv(data_path)
    
    feature_cols = [
        "team_size",
        "planned_duration_days",
        "total_tasks",
        "remaining_hard_tasks",
        "remaining_high_priority_tasks",
        "elapsed_time_ratio",
        "task_completion_ratio",
        "overdue_tasks_count",
        "avg_member_kpi"
    ]
    target_col = "delay_risk_level"
    class_labels = ["Low", "Medium", "High"]

    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ── Nâng cấp hyperparameters ──────────────────────────────────────
    print("[train_rf] Đang huấn luyện Random Forest (nâng cấp)...")
    rf = RandomForestClassifier(
        n_estimators=300,           # Tăng số cây 
        max_depth=15,               # Tăng depth 
        min_samples_split=5,        # Tránh overfitting
        min_samples_leaf=2,         # Tránh overfit trên leaf nhỏ
        max_features="sqrt",        # Chọn feature tối ưu
        class_weight="balanced",    # Cân bằng class
        random_state=42,
        n_jobs=-1,                  # Song song tất cả cores
    )
    rf.fit(X_train, y_train)

    # ── Cross-Validation (5-fold) ─────────────────────────────────────
    print("[train_rf] Đang đánh giá Cross-Validation (5-fold)...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf, X, y, cv=cv, scoring="accuracy")
    cv_mean = float(np.mean(cv_scores))
    cv_std = float(np.std(cv_scores))
    print(f"  Cross-Validation Accuracy: {cv_mean:.4f} ± {cv_std:.4f}")

    # ── Đánh giá trên tập Test ────────────────────────────────────────
    y_pred = rf.predict(X_test)

    # Accuracy
    acc = float(accuracy_score(y_test, y_pred))
    print(f"\n=== Accuracy trên tập Test: {acc:.4f} ({acc*100:.2f}%) ===")

    # Classification Report (dạng dict để lưu)
    cls_report_dict = classification_report(
        y_test, y_pred,
        target_names=class_labels,
        output_dict=True,
        zero_division=0,
    )
    cls_report_str = classification_report(
        y_test, y_pred,
        target_names=class_labels,
        zero_division=0,
    )
    print("\n=== Classification Report ===")
    print(cls_report_str)

    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    print("\n=== Confusion Matrix ===")
    print(f"Labels: {class_labels}")
    print(cm)

    # Macro & Weighted metrics
    precision_macro = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
    recall_macro = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
    f1_macro = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    precision_weighted = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
    recall_weighted = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
    f1_weighted = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

    # Feature importances
    importances = rf.feature_importances_
    feature_importances = sorted(zip(feature_cols, importances), key=lambda x: x[1], reverse=True)
    
    print("\n=== Mức độ quan trọng của các Features (Top 5) ===")
    for feat, imp in feature_importances[:5]:
        print(f"  - {feat}: {imp:.4f}")

    # ── Lưu mô hình + toàn bộ metrics ────────────────────────────────
    out_path = ROOT_DIR / "models" / "rf_project_delay.pkl"
    bundle = {
        "model": rf,
        "feature_columns": feature_cols,
        "feature_importances": feature_importances,
        # ─── Metrics đánh giá chi tiết ───
        "accuracy": acc,
        "confusion_matrix": cm.tolist(),          # list-of-list để JSON-safe
        "class_labels": class_labels,
        "classification_report": cls_report_dict,
        # ─── Cross-Validation ───
        "cv_accuracy_mean": cv_mean,
        "cv_accuracy_std": cv_std,
        "cv_scores": cv_scores.tolist(),
        # ─── Macro & Weighted ───
        "precision_macro": precision_macro,
        "recall_macro": recall_macro,
        "f1_macro": f1_macro,
        "precision_weighted": precision_weighted,
        "recall_weighted": recall_weighted,
        "f1_weighted": f1_weighted,
        # ─── Tập test info ───
        "test_size": len(y_test),
        "train_size": len(y_train),
        "total_samples": len(y),
    }
    joblib.dump(bundle, out_path)
    print(f"\n[train_rf] Đã lưu mô hình + metrics tại {out_path}")


if __name__ == "__main__":
    train_rf()
