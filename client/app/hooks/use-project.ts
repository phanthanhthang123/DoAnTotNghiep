import { fetchData, postData, updateData, deleteData } from "@/lib/fetch-utlis";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectFormData } from "@/components/project/create-project";
import { toast } from "sonner";
import { useAuth } from "@/provider/auth-context";
import type { Project, Task } from "@/type";

export const UseCreateProject = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (data: { workspaceId: string, projectData: CreateProjectFormData }) => {
            if (!user?.id) {
                throw new Error("Người dùng chưa được xác thực");
            }
            const requestData = {
                ...data.projectData,
                created_by: user.id
            };
            return await postData(`/project/${data.workspaceId}/create-project`, requestData);
        },
        onSuccess: (data: any) => {
            toast.success("Tạo dự án thành công");
            queryClient.invalidateQueries({ queryKey: ["workspace", data.workspaceId] });
        },
        onError: (error: any) => {
            const errorMessage = (error as any)?.response?.data?.msg || error?.message || "Không thể tạo dự án";
            toast.error(errorMessage);
        }
    })
}
export const useProjectQueryById = (projectId: string) => {
    return useQuery<{
        err: number;
        msg: string;
        project: Project;
        tasks: Task[];
        code?: string;
    }>({
        queryKey: ["project", projectId],
        queryFn: async () => {
            return await fetchData<{
                err: number;
                msg: string;
                project: Project;
                tasks: Task[];
                code?: string;
            }>(`/project/${projectId}/tasks`);
        },
        retry: false, // Don't retry on 403 errors
    })
}

export const useUpdateProjectTitleMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { projectId: string; title: string }) => {
            return await updateData(`/project/${data.projectId}/update-title`, { title: data.title });
        },
        onSuccess: (response: any, variables) => {
            queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
            toast.success("Cập nhật tên dự án thành công");
        },
        onError: (error: any) => {
            const errorMessage = error?.response?.data?.msg || "Không thể cập nhật tên dự án";
            toast.error(errorMessage);
        }
    });
}

export const useUpdateProjectDescriptionMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { projectId: string; description: string }) => {
            return await updateData(`/project/${data.projectId}/update-description`, { description: data.description });
        },
        onSuccess: (response: any, variables) => {
            queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
            toast.success("Cập nhật mô tả dự án thành công");
        },
        onError: (error: any) => {
            const errorMessage = error?.response?.data?.msg || "Không thể cập nhật mô tả dự án";
            toast.error(errorMessage);
        }
    });
}

export const useUpdateProjectStatusMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { projectId: string; status: string }) => {
            return await updateData(`/project/${data.projectId}/update-status`, { status: data.status });
        },
        onSuccess: (response: any, variables) => {
            queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
            toast.success("Cập nhật trạng thái dự án thành công");
        },
        onError: (error: any) => {
            const errorMessage = error?.response?.data?.msg || "Không thể cập nhật trạng thái dự án";
            toast.error(errorMessage);
        }
    });
}

export const useAddMemberToProjectMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { projectId: string; userId: string; role?: string }) => {
            return await postData(`/project/${data.projectId}/add-member`, { 
                userId: data.userId, 
                role: data.role || 'Developer' 
            });
        },
        onSuccess: (response: any, variables) => {
            queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
            toast.success("Thêm thành viên thành công");
        },
        onError: (error: any) => {
            const errorMessage = error?.response?.data?.msg || "Không thể thêm thành viên";
            toast.error(errorMessage);
        }
    });
}

export const useRemoveMemberFromProjectMutation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: { projectId: string; userId: string }) => {
            return await deleteData(`/project/${data.projectId}/remove-member/${data.userId}`);
        },
        onSuccess: (response: any, variables) => {
            queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
            toast.success("Xóa thành viên thành công");
        },
        onError: (error: any) => {
            const errorMessage = error?.response?.data?.msg || "Không thể xóa thành viên";
            toast.error(errorMessage);
        }
    });
}

// ===== AI Prediction =====
export interface PredictionSuggestion {
    feature: string;
    importance: number;
    description: string;
    suggestion: string;
}

export interface PerClassMetric {
    label: string;
    precision: number;
    recall: number;
    f1_score: number;
    support: number;
}

export interface PredictionConfidence {
    probabilities: Record<string, number>;
    predicted_class: string;
    confidence_percent: number;
}

export interface ModelEvaluation {
    accuracy: number;
    confusion_matrix: number[][];
    class_labels: string[];
    per_class_metrics: PerClassMetric[];
    cv_accuracy_mean: number;
    cv_accuracy_std: number;
    cv_scores: number[];
    precision_macro: number;
    recall_macro: number;
    f1_macro: number;
    precision_weighted: number;
    recall_weighted: number;
    f1_weighted: number;
    test_size: number;
    train_size: number;
    total_samples: number;
    prediction_confidence: PredictionConfidence;
}

export interface PredictionResult {
    err: number;
    msg: string;
    prediction: {
        risk_level: 'Low' | 'Medium' | 'High';
        input_summary: {
            team_size: number;
            planned_duration_days: number;
            total_tasks: number;
            remaining_hard_tasks: number;
            remaining_high_priority_tasks: number;
            elapsed_time_ratio: number;
            task_completion_ratio: number;
            overdue_tasks_count: number;
        };
        suggestions: PredictionSuggestion[];
        model_evaluation: ModelEvaluation | null;
    };
}

export const useProjectDelayPrediction = () => {
    return useMutation({
        mutationFn: async (projectId: string) => {
            return await fetchData<PredictionResult>(`/project/${projectId}/predict-delay`);
        },
        onError: (error: any) => {
            const errorMessage = error?.response?.data?.msg || "Không thể phân tích rủi ro dự án";
            toast.error(errorMessage);
        }
    });
}