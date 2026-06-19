import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router';
import type { Task } from '@/type';
import { useProjectQueryById, useUpdateProjectTitleMutation, useUpdateProjectDescriptionMutation, useAddMemberToProjectMutation, useRemoveMemberFromProjectMutation, useProjectDelayPrediction } from '@/hooks/use-project';
import type { PredictionResult, ModelEvaluation } from '@/hooks/use-project';
import type { TaskStatus } from '@/type';
import { Loader } from '@/components/loader';
import { getProjectProgress } from '@/lib';
import { fetchData } from '@/lib/fetch-utlis';
import { BackButton } from '@/components/back-button';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CreateTaskDialog } from '@/components/task/create-task-dialog';
import { TaskCard } from '@/components/task/task-card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useArchiveTaskMutation } from '@/hooks/use-task';
import { Archive, CheckSquare, Users, Edit, Trash2, UserPlus, CalendarDays, Search, ChevronDown, ChevronRight, ExternalLink, Copy, Github, BrainCircuit, AlertTriangle, Lightbulb, ShieldCheck, ShieldAlert, Loader2, BarChart3, Target, TrendingUp, Activity } from 'lucide-react';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/provider/auth-context';
import { useGetAllUsersQuery } from '@/hooks/use-workspace';
import { useMemo } from 'react';

const TASKS_PER_PAGE_TABLE = 10;

const ProjectDetails = () => {

    const { projectId, workspaceId } = useParams<{ projectId: string, workspaceId: string }>();
    const navigate = useNavigate();

    const [isCreateTask, setIsCreateTask] = useState(false);
    const [taskFilter, setTaskFilter] = useState<'All' | 'To Do' | 'In Progress' | 'Done' | 'Archived'>('All');
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
    const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
    const [isDeleteMemberConfirmOpen, setIsDeleteMemberConfirmOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<{ userId: string; username: string } | null>(null);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [expandedStatuses, setExpandedStatuses] = useState<Record<string, boolean>>({});
    const [statusPages, setStatusPages] = useState<Record<string, number>>({});
    const [taskPage, setTaskPage] = useState(1);
    const { user } = useAuth();
    const [isPredictionDialogOpen, setIsPredictionDialogOpen] = useState(false);
    const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);

    // All hooks must be called before any conditional returns
    const { data, isLoading, error } = useProjectQueryById(projectId!);
    const queryClient = useQueryClient();
    const { mutate: archiveTask, isPending: isArchiving } = useArchiveTaskMutation();
    const { mutate: updateTitle, isPending: isUpdatingTitle } = useUpdateProjectTitleMutation();
    const { mutate: updateDescription, isPending: isUpdatingDescription } = useUpdateProjectDescriptionMutation();
    const { mutate: addMember, isPending: isAddingMember } = useAddMemberToProjectMutation();
    const { mutate: removeMember, isPending: isRemovingMember } = useRemoveMemberFromProjectMutation();
    const [isPredictingLocal, setIsPredictingLocal] = useState(false);
    // const { mutate: predictDelay, isPending: isPredicting } = useProjectDelayPrediction();
    const { data: usersData, isLoading: isLoadingUsers } = useGetAllUsersQuery(searchQuery);

    // Extract project and tasks early (before any hooks that depend on them)
    const project = data?.project;
    const tasks = data?.tasks || [];

    // Filter out archived tasks from main view
    const activeTasks = useMemo(() => tasks?.filter(task => !task.isArchived) || [], [tasks]);
    const archivedTasks = useMemo(() => tasks?.filter(task => task.isArchived) || [], [tasks]);

    // Filter tasks based on search query
    const filteredActiveTasks = useMemo(() => {
        if (!taskSearchQuery.trim()) {
            return activeTasks;
        }
        const query = taskSearchQuery.toLowerCase();
        return activeTasks.filter((task) => {
            const title = (task.title || "").toLowerCase();
            const description = (task.description || "").toLowerCase();
            return title.includes(query) || description.includes(query);
        });
    }, [activeTasks, taskSearchQuery]);

    const filteredArchivedTasks = useMemo(() => {
        if (!taskSearchQuery.trim()) {
            return archivedTasks;
        }
        const query = taskSearchQuery.toLowerCase();
        return archivedTasks.filter((task) => {
            const title = (task.title || "").toLowerCase();
            const description = (task.description || "").toLowerCase();
            return title.includes(query) || description.includes(query);
        });
    }, [archivedTasks, taskSearchQuery]);

    // Group tasks by status
    const tasksByStatus = useMemo(() => {
        const grouped: Record<string, Task[]> = {
            'To Do': filteredActiveTasks.filter(task => task.status === 'To Do'),
            'In Progress': filteredActiveTasks.filter(task => task.status === 'In Progress'),
            'Done': filteredActiveTasks.filter(task => task.status === 'Done'),
        };
        return grouped;
    }, [filteredActiveTasks]);

    const getDifficultyLabel = (difficulty?: string | null) => {
        switch ((difficulty || "").toString()) {
            case "Easy":
                return "Dễ";
            case "Hard":
                return "Khó";
            case "Medium":
            default:
                return "Trung bình";
        }
    };

    // Tasks for table view by status filter + pagination
    const statusFilteredTasks = useMemo(() => {
        if (taskFilter === 'All') return filteredActiveTasks;
        return filteredActiveTasks.filter((task) => task.status === taskFilter);
    }, [filteredActiveTasks, taskFilter]);

    const totalTaskPages = useMemo(() => {
        if (statusFilteredTasks.length === 0) return 1;
        return Math.ceil(statusFilteredTasks.length / TASKS_PER_PAGE_TABLE);
    }, [statusFilteredTasks.length]);

    const paginatedStatusTasks = useMemo(() => {
        const safePage = Math.min(Math.max(taskPage, 1), totalTaskPages);
        const startIndex = (safePage - 1) * TASKS_PER_PAGE_TABLE;
        const endIndex = startIndex + TASKS_PER_PAGE_TABLE;
        return statusFilteredTasks.slice(startIndex, endIndex);
    }, [statusFilteredTasks, taskPage, totalTaskPages]);

    // Reset page when filter hoặc search thay đổi
    useEffect(() => {
        setTaskPage(1);
    }, [taskFilter, taskSearchQuery]);

    // Initialize expanded statuses and pages
    React.useEffect(() => {
        const initialExpanded: Record<string, boolean> = {};
        const initialPages: Record<string, number> = {};
        Object.keys(tasksByStatus).forEach((status) => {
            initialExpanded[status] = true;
            initialPages[status] = 1;
        });
        setExpandedStatuses(initialExpanded);
        setStatusPages(initialPages);
    }, [filteredActiveTasks.length]);

    const toggleStatus = (status: string) => {
        setExpandedStatuses(prev => ({
            ...prev,
            [status]: !prev[status]
        }));
    };

    const setStatusPage = (status: string, page: number) => {
        setStatusPages(prev => ({
            ...prev,
            [status]: page
        }));
    };

    const projectProgess = useMemo(() => getProjectProgress(activeTasks as { status: TaskStatus }[]), [activeTasks]);

    // Get project statistics
    const totalTasksInProject = useMemo(() => tasks?.length || 0, [tasks]);
    const totalMembersInProject = useMemo(() => (project as any)?.members?.length || 0, [project]);

    // Check if current user is leader - must be called before early return
    const isCurrentUserLeader = useMemo(() => {
        if (!user || !project) return false;
        const leaderId = typeof (project as any).leader_id === 'string'
            ? (project as any).leader_id
            : (project as any).leader?.id || (project as any).leader_id;
        if (leaderId === user.id || (project as any).created_by === user.id) return true;
        return (project as any)?.members?.some((member: any) => {
            const memberUserId = typeof member.user === 'string' ? member.user : member.user?.id || member.user_id;
            return memberUserId === user.id && member.role === 'Leader';
        }) || false;
    }, [user, project]);

    // Filter available users (not already members) - must be called before early return
    const availableUsers = useMemo(() => {
        const users = (usersData as any)?.response || [];
        if (!users || users.length === 0 || !project) return [];
        const existingMemberIds = ((project as any)?.members || []).map((m: any) =>
            typeof m.user === 'string' ? m.user : m.user?.id || m.user_id
        );
        return users.filter((user: any) => !existingMemberIds.includes(user.id));
    }, [usersData, project]);

    // Initialize title and description
    useEffect(() => {
        if (project && !isEditingTitle) {
            setNewTitle(project.name || '');
        }
        if (project && !isEditingDescription) {
            setNewDescription(project.description || '');
        }
    }, [project, isEditingTitle, isEditingDescription]);

    // Handle access denied error
    useEffect(() => {
        if (error && (error as any)?.response?.status === 403) {
            const errorMsg = (error as any)?.response?.data?.msg || "Bạn không phải là thành viên trong project này";
            toast.error(errorMsg);
            // Redirect back to workspace
            if (workspaceId) {
                navigate(`/workspaces/${workspaceId}`);
            } else {
                navigate('/dashboard');
            }
        } else if (error) {
            toast.error("Không thể tải dự án");
        }
    }, [error, navigate, workspaceId]);

    // Early returns after all hooks are called
    if (isLoading) {
        return (
            <div>
                <Loader />
            </div>
        )
    }

    if (!data || data.err !== 0) {
        // Check if it's a permission error
        if (data?.code === "NOT_PROJECT_MEMBER" || data?.msg?.includes("không phải là thành viên")) {
            return null; // Will be handled by useEffect
        }
        return (
            <div>
                <p>Không thể tải dự án</p>
            </div>
        )
    }

    if (!project) {
        return (
            <div>
                <p>Không tìm thấy dự án</p>
            </div>
        )
    }

    console.log("task", tasks)

    const handleEditTitle = () => {
        setIsEditingTitle(true);
        setNewTitle(project?.name || '');
    };

    const handleSaveTitle = () => {
        if (!newTitle.trim()) {
            toast.error("Tên dự án không được để trống");
            return;
        }
        updateTitle({ projectId: projectId!, title: newTitle }, {
            onSuccess: () => {
                setIsEditingTitle(false);
            }
        });
    };

    const handleCancelTitle = () => {
        setNewTitle(project?.name || '');
        setIsEditingTitle(false);
    };

    const handleEditDescription = () => {
        setIsEditingDescription(true);
        setNewDescription(project?.description || '');
    };

    const handleSaveDescription = () => {
        updateDescription({ projectId: projectId!, description: newDescription }, {
            onSuccess: () => {
                setIsEditingDescription(false);
            }
        });
    };

    const handleCancelDescription = () => {
        setNewDescription(project?.description || '');
        setIsEditingDescription(false);
    };

    const handleAddMember = () => {
        if (!selectedUserId) {
            toast.error("Vui lòng chọn thành viên");
            return;
        }
        addMember({ projectId: projectId!, userId: selectedUserId }, {
            onSuccess: () => {
                setIsAddMemberDialogOpen(false);
                setSelectedUserId('');
                setSearchQuery('');
            }
        });
    };

    const handleRemoveMember = (userId: string, username: string) => {
        setMemberToDelete({ userId, username });
        setIsDeleteMemberConfirmOpen(true);
    };

    const handleConfirmRemove = () => {
        if (memberToDelete) {
            removeMember({ projectId: projectId!, userId: memberToDelete.userId }, {
                onSuccess: () => {
                    setIsDeleteMemberConfirmOpen(false);
                    setMemberToDelete(null);
                }
            });
        }
    };

    const handleTaskClick = (taskId: string) => {
        navigate(`/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`);
    }

    const handlePredictDelay = async () => {
        if (!projectId) return;
        try {
            setIsPredictingLocal(true);
            console.log("Calling API manually...");
            const data = await fetchData<PredictionResult>(`/project/${projectId}/predict-delay`);
            console.log("Prediction success data:", data);
            toast.success("Phân tích hoàn tất!");
            setPredictionResult(data);
            setIsPredictionDialogOpen(true);
            // Invalidate project query to refresh stored prediction card in UI
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
        } catch (err: any) {
            console.error("Prediction error:", err);
            toast.error("Lỗi: " + (err?.response?.data?.msg || err.message));
        } finally {
            setIsPredictingLocal(false);
        }
    };

    const handleUnarchiveTask = (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigation when clicking unarchive button
        archiveTask({ taskId }, {
            onSuccess: () => {
                // Invalidate project query to refresh the task list
                queryClient.invalidateQueries({
                    queryKey: ["project", projectId],
                });
            }
        });
    }


    return (
        <div className='space-y-6'>
            {/* Header Section */}
            <div className='bg-gradient-to-r from-background to-muted/30 rounded-lg border p-4 md:p-6 shadow-sm'>
                <BackButton />
                <div className='flex flex-col md:flex-row md:items-start justify-between gap-6 mt-4'>
                    <div className='flex-1 space-y-4'>
                        <div className='flex items-center gap-3'>
                            {isEditingTitle ? (
                                <Input
                                    className="text-2xl md:text-3xl font-bold h-auto py-2"
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    disabled={isUpdatingTitle}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveTitle();
                                        if (e.key === 'Escape') handleCancelTitle();
                                    }}
                                    autoFocus
                                />
                            ) : (
                                <>
                                    <h1 className='text-2xl md:text-3xl font-bold text-foreground'>{project?.name}</h1>
                                    {isCurrentUserLeader && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleEditTitle}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Edit className="size-4" />
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                        {isEditingTitle && (
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleSaveTitle}
                                    disabled={isUpdatingTitle}
                                >
                                    Lưu
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelTitle}
                                    disabled={isUpdatingTitle}
                                >
                                    Hủy
                                </Button>
                            </div>
                        )}

                        {/* GitHub Repository */}
                        <div className="rounded-lg border bg-background/60 p-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Github className="size-4 text-muted-foreground" />
                                GitHub Repository
                            </div>
                            <div className="mt-2 flex flex-col md:flex-row gap-2">
                                <Input
                                    value={(project as any)?.githubRepoUrl || ""}
                                    readOnly
                                    placeholder="Chưa có URL repository GitHub"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            const url = ((project as any)?.githubRepoUrl || "").toString().trim();
                                            if (!url) return;
                                            window.open(url, "_blank", "noopener,noreferrer");
                                        }}
                                        disabled={!((project as any)?.githubRepoUrl || "").toString().trim()}
                                    >
                                        <ExternalLink className="mr-2 size-4" />
                                        Mở GitHub
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={async () => {
                                            const url = ((project as any)?.githubRepoUrl || "").toString().trim();
                                            if (!url) return;
                                            try {
                                                await navigator.clipboard.writeText(url);
                                                toast.success("Đã copy link GitHub repository");
                                            } catch {
                                                toast.error("Không thể copy link GitHub repository");
                                            }
                                        }}
                                        disabled={!((project as any)?.githubRepoUrl || "").toString().trim()}
                                    >
                                        <Copy className="mr-2 size-4" />
                                        Copy
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className='space-y-2'>
                            {isEditingDescription ? (
                                <>
                                    <Textarea
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                        className='text-sm min-h-[80px]'
                                        disabled={isUpdatingDescription}
                                        placeholder="Nhập mô tả dự án..."
                                        autoFocus
                                    />
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            onClick={handleSaveDescription}
                                            disabled={isUpdatingDescription}
                                        >
                                            Lưu
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleCancelDescription}
                                            disabled={isUpdatingDescription}
                                        >
                                            Hủy
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className='flex items-start gap-2'>
                                    {project?.description ? (
                                        <p className='text-sm text-muted-foreground leading-relaxed'>{project?.description}</p>
                                    ) : (
                                        <p className='text-sm text-muted-foreground/60 italic'>Chưa có mô tả</p>
                                    )}
                                    {isCurrentUserLeader && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleEditDescription}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Edit className="size-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className='flex flex-col gap-4 md:min-w-[280px]'>
                        {/* Progress Section */}
                        <Card className="p-4">
                            <div className='space-y-2'>
                                <div className='flex items-center justify-between'>
                                    <span className='text-sm font-medium'>Tiến độ dự án</span>
                                    <span className='text-sm font-bold text-primary'>{projectProgess ? projectProgess : 0}%</span>
                                </div>
                                <Progress value={projectProgess ? projectProgess : 0} className='h-2.5' />
                            </div>
                        </Card>

                        {/* Stored AI Prediction Card */}
                        {(project as any)?.prediction && (
                            <Card className={cn(
                                "p-4 border-l-4",
                                (project as any).prediction.delay_risk_level === 'High' ? "border-l-red-500 bg-red-50/30 dark:bg-red-950/10" :
                                (project as any).prediction.delay_risk_level === 'Medium' ? "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10" :
                                "border-l-green-500 bg-green-50/30 dark:bg-green-950/10"
                            )}>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phân tích rủi ro gần nhất</span>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] py-0 px-1.5 font-bold",
                                            (project as any).prediction.delay_risk_level === 'High' ? "bg-red-100 text-red-800 border-red-200" :
                                            (project as any).prediction.delay_risk_level === 'Medium' ? "bg-amber-100 text-amber-800 border-amber-200" :
                                            "bg-green-100 text-green-800 border-green-200"
                                        )}>
                                            {(project as any).prediction.delay_risk_level === 'High' ? 'Rủi ro Cao' :
                                             (project as any).prediction.delay_risk_level === 'Medium' ? 'Trung bình' : 'Rủi ro Thấp'}
                                        </Badge>
                                    </div>
                                    <div className="text-xs space-y-1">
                                        {(project as any).prediction.estimated_completion_date && (
                                            <p className="text-muted-foreground">
                                                Hoàn thành dự kiến: <span className="font-medium text-foreground">{format(new Date((project as any).prediction.estimated_completion_date), "MMM d, yyyy")}</span>
                                            </p>
                                        )}
                                        {(project as any).prediction.delay_reason && (project as any).prediction.delay_reason !== 'N/A' && (
                                            <p className="text-[11px] italic text-muted-foreground line-clamp-2" title={(project as any).prediction.delay_reason}>
                                                Nguyên nhân: {(project as any).prediction.delay_reason}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* Action Buttons */}
                        <div className='flex flex-col gap-2'>
                            {isCurrentUserLeader && (
                                <Button
                                    variant="outline"
                                    onClick={() => setIsAddMemberDialogOpen(true)}
                                    className="w-full"
                                >
                                    <UserPlus className="mr-2 size-4" />
                                    Thêm Thành Viên
                                </Button>
                            )}
                            <Button onClick={() => setIsCreateTask(true)} className="w-full">
                                <CheckSquare className="mr-2 size-4" />
                                Thêm Task
                            </Button>
                            {isCurrentUserLeader && (
                                <Button
                                    variant="outline"
                                    onClick={handlePredictDelay}
                                    disabled={isPredictingLocal}
                                    className="w-full border-amber-500/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-400 dark:hover:bg-amber-950 dark:hover:text-amber-300"
                                >
                                    {isPredictingLocal ? (
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                    ) : (
                                        <BrainCircuit className="mr-2 size-4" />
                                    )}
                                    {isPredictingLocal ? 'Đang phân tích...' : 'Đánh giá rủi ro (AI)'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Project Statistics */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
                <Card
                    className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group py-3"
                    onClick={() => setIsTaskDialogOpen(true)}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-3">
                        <CardTitle className="text-xs font-semibold">Tổng Task</CardTitle>
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <CheckSquare className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                        <div className="text-xl font-bold text-foreground">{totalTasksInProject}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Task trong dự án
                        </p>
                    </CardContent>
                </Card>

                <Card
                    className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group py-3"
                    onClick={() => setIsMemberDialogOpen(true)}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-3">
                        <CardTitle className="text-xs font-semibold">Thành Viên</CardTitle>
                        <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                            <Users className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                        <div className="text-xl font-bold text-foreground">{totalMembersInProject}</div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Thành viên trong dự án
                        </p>
                    </CardContent>
                </Card>

                {(project as any)?.start_date && (
                    <Card className="hover:shadow-lg hover:border-primary/50 transition-all py-3">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-3">
                            <CardTitle className="text-xs font-semibold">Bắt Đầu</CardTitle>
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <CalendarDays className="h-4 w-4 text-green-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                            <div className="text-base font-bold text-foreground">
                                {format(new Date((project as any).start_date), "MMM d, yyyy")}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Ngày bắt đầu dự án
                            </p>
                        </CardContent>
                    </Card>
                )}

                {(project as any)?.end_date && (
                    <Card className="hover:shadow-lg hover:border-primary/50 transition-all py-3">
                        <CardHeader className="flex flex-row items-center justify-between pb-1 px-4 pt-3">
                            <CardTitle className="text-xs font-semibold">Kết Thúc</CardTitle>
                            <div className="p-2 rounded-lg bg-orange-500/10">
                                <CalendarDays className="h-4 w-4 text-orange-600" />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                            <div className="text-base font-bold text-foreground">
                                {format(new Date((project as any).end_date), "MMM d, yyyy")}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Ngày kết thúc dự án
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Task Details Dialog */}
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Chi Tiết Task</DialogTitle>
                        <DialogDescription>
                            Danh sách tất cả task trong dự án
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[400px] mt-4">
                        <div className="space-y-2 pr-4">
                            {tasks && tasks.length > 0 ? (
                                tasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between p-3 rounded-md border hover:bg-accent transition-colors cursor-pointer"
                                        onClick={() => {
                                            setIsTaskDialogOpen(false);
                                            handleTaskClick(task.id);
                                        }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{task.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        task.status === 'Done'
                                                            ? "bg-green-100 text-green-800"
                                                            : task.status === 'In Progress'
                                                                ? "bg-blue-100 text-blue-800"
                                                                : "bg-gray-100 text-gray-800"
                                                    }
                                                >
                                                    {task.status === 'To Do' ? 'Chưa Làm' : task.status === 'In Progress' ? 'Đang Làm' : 'Hoàn Thành'}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        task.priority === 'High'
                                                            ? "bg-red-100 text-red-800"
                                                            : task.priority === 'Medium'
                                                                ? "bg-yellow-100 text-yellow-800"
                                                                : "bg-gray-100 text-gray-800"
                                                    }
                                                >
                                                    {task.priority}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className="bg-slate-100 text-slate-800"
                                                >
                                                    {getDifficultyLabel((task as any).difficulty)}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                    Chưa có task nào
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Member Details Dialog */}
            <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Thành Viên Dự Án</DialogTitle>
                        <DialogDescription>
                            Danh sách tất cả thành viên trong dự án này
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[400px] mt-4">
                        {totalMembersInProject > 0 ? (
                            <div className="space-y-2 pr-4">
                                {(project as any)?.members?.map((member: any, index: number) => {
                                    const memberUser = typeof member.user === 'object' ? member.user : null;
                                    const memberUserId = typeof member.user === 'string' ? member.user : member.user?.id || member.user_id;

                                    // Role hệ thống gốc trên user (có thể dạng admin/kleader/member hoặc Admin/Leader/Member)
                                    const systemRoleRaw = (memberUser?.role as string | undefined) || '';
                                    // Role trong project (Leader/Manager/Developer/leader/manager/...)
                                    const projectRoleRaw = (member.role as string | undefined) || '';

                                    const systemRole = systemRoleRaw.toLowerCase();
                                    const projectRole = projectRoleRaw.toLowerCase();

                                    // Xác định leader để chặn nút xoá
                                    const isLeader =
                                        projectRole === 'leader' ||
                                        (project as any).leader_id === memberUserId ||
                                        systemRole === 'leader' ||
                                        systemRole === 'kleader';

                                    const canDelete = isCurrentUserLeader && !isLeader && memberUserId !== user?.id;

                                    const getLastNameInitial = (username: string) => {
                                        if (!username || username.trim() === "") return "";
                                        const names = username.trim().split(" ").filter(name => name.length > 0);
                                        if (names.length === 0) return "";
                                        const lastName = names[names.length - 1];
                                        return lastName.charAt(0).toUpperCase();
                                    };

                                    return (
                                        <div
                                            key={member.user_id || index}
                                            className="flex items-center gap-3 p-3 rounded-md border hover:bg-accent transition-colors"
                                        >
                                            <Avatar className="size-10">
                                                <AvatarImage
                                                    src={memberUser?.avatarUrl || undefined}
                                                    alt={memberUser?.username || "User Avatar"}
                                                />
                                                <AvatarFallback>
                                                    {memberUser?.username
                                                        ? getLastNameInitial(memberUser.username)
                                                        : "U"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium truncate">
                                                        {memberUser?.username || "Người dùng không xác định"}
                                                    </p>
                                                    <Badge variant="outline" className="text-xs">
                                                        {systemRole === 'admin'
                                                            ? 'Admin'
                                                            : systemRole === 'leader' || systemRole === 'kleader'
                                                                ? 'Leader'
                                                                : systemRole === 'member'
                                                                    ? 'Member'
                                                                    : projectRole === 'leader'
                                                                        ? 'Leader'
                                                                        : 'Member'}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {memberUser?.email || "Không có email"}
                                                </p>
                                            </div>
                                            {canDelete && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveMember(memberUserId, memberUser?.username || "Người dùng không xác định")}
                                                    disabled={isRemovingMember}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                Chưa có thành viên nào
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Thêm Thành Viên</DialogTitle>
                        <DialogDescription>
                            Thêm thành viên mới vào dự án này
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div>
                            <label className="text-sm font-medium">Tìm Người Dùng</label>
                            <Input
                                placeholder="Tìm theo tên hoặc email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="mt-2"
                            />
                        </div>
                        <ScrollArea className="h-[300px] border rounded-md mt-2">
                            {isLoadingUsers ? (
                                <div className="flex items-center justify-center p-4">
                                    <Loader />
                                </div>
                            ) : availableUsers.length === 0 ? (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                    {searchQuery ? "Không tìm thấy người dùng" : "Bắt đầu nhập để tìm kiếm"}
                                </div>
                            ) : (
                                <div className="p-2 space-y-2">
                                    {availableUsers.map((userItem: any) => {
                                        const isSelected = selectedUserId === userItem.id;
                                        return (
                                            <div
                                                key={userItem.id}
                                                onClick={() => setSelectedUserId(userItem.id)}
                                                className={`flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-colors ${isSelected
                                                        ? "bg-primary/10 border-primary"
                                                        : "hover:bg-accent border-transparent"
                                                    }`}
                                            >
                                                <Avatar className="size-8">
                                                    <AvatarImage src={userItem.avatarUrl || undefined} />
                                                    <AvatarFallback>
                                                        {userItem.username?.charAt(0).toUpperCase() || "U"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{userItem.username}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{userItem.email}</p>
                                                </div>
                                                {isSelected && (
                                                    <div className="size-4 rounded-full bg-primary flex items-center justify-center">
                                                        <div className="size-2 rounded-full bg-primary-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsAddMemberDialogOpen(false);
                                setSelectedUserId('');
                                setSearchQuery('');
                            }}
                            disabled={isAddingMember}
                        >
                            Hủy
                        </Button>
                        <Button
                            onClick={handleAddMember}
                            disabled={isAddingMember || !selectedUserId}
                        >
                            {isAddingMember ? "Đang thêm..." : "Thêm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete Member Dialog */}
            <Dialog open={isDeleteMemberConfirmOpen} onOpenChange={setIsDeleteMemberConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Xác Nhận Xóa</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn xóa <strong>{memberToDelete?.username}</strong> khỏi dự án này? Hành động này không thể hoàn tác.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsDeleteMemberConfirmOpen(false);
                                setMemberToDelete(null);
                            }}
                            disabled={isRemovingMember}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmRemove}
                            disabled={isRemovingMember}
                        >
                            {isRemovingMember ? "Đang xóa..." : "Xóa Thành Viên"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Tasks Section */}
            <div className="space-y-4">
                {/* Search Bar */}
                <div className="p-4 bg-muted/30 rounded-lg border">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Tìm kiếm task..."
                            value={taskSearchQuery}
                            onChange={(e) => setTaskSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Modern Status Board */}
                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="pb-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <CardTitle className="text-lg md:text-xl">
                                    Bảng Trạng Thái Task
                                </CardTitle>
                                <p className="text-xs md:text-sm text-muted-foreground">
                                    Nhìn nhanh toàn bộ luồng công việc từ Chưa Làm → Đang Làm → Hoàn Thành.
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 md:gap-4 text-xs md:text-sm">
                                <div className="rounded-lg bg-blue-50 px-3 py-2 border border-blue-100">
                                    <p className="font-medium text-blue-800">Chưa Làm</p>
                                    <p className="text-blue-600">
                                        {tasksByStatus["To Do"]?.length || 0} task
                                    </p>
                                </div>
                                <div className="rounded-lg bg-amber-50 px-3 py-2 border border-amber-100">
                                    <p className="font-medium text-amber-800">Đang Làm</p>
                                    <p className="text-amber-600">
                                        {tasksByStatus["In Progress"]?.length || 0} task
                                    </p>
                                </div>
                                <div className="rounded-lg bg-emerald-50 px-3 py-2 border border-emerald-100">
                                    <p className="font-medium text-emerald-800">Hoàn Thành</p>
                                    <p className="text-emerald-600">
                                        {tasksByStatus["Done"]?.length || 0} task
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Bộ lọc trạng thái cho bảng */}
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap gap-2">
                                {([
                                    { key: 'All', label: 'Tất cả' },
                                    { key: 'To Do', label: 'Chưa Làm' },
                                    { key: 'In Progress', label: 'Đang Làm' },
                                    { key: 'Done', label: 'Hoàn Thành' },
                                ] as const).map((item) => (
                                    <Button
                                        key={item.key}
                                        type="button"
                                        size="sm"
                                        variant={taskFilter === item.key ? 'default' : 'outline'}
                                        onClick={() => setTaskFilter(item.key)}
                                        className="text-xs md:text-sm"
                                    >
                                        {item.label}
                                    </Button>
                                ))}
                            </div>
                            <div className="text-xs md:text-sm text-muted-foreground">
                                Đang hiển thị {paginatedStatusTasks.length} / {statusFilteredTasks.length} task
                            </div>
                        </div>

                        {/* Bảng task theo trạng thái + phân trang */}
                        <div className="rounded-xl border bg-background overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/60 border-b">
                                        <tr className="text-left">
                                            <th className="px-4 py-2 w-[60px] font-medium text-xs text-muted-foreground">
                                                ID
                                            </th>
                                            <th className="px-4 py-2 min-w-[220px] font-medium text-xs text-muted-foreground">
                                                Tiêu đề
                                            </th>
                                            <th className="px-4 py-2 min-w-[120px] font-medium text-xs text-muted-foreground">
                                                Trạng thái
                                            </th>
                                            <th className="px-4 py-2 min-w-[100px] font-medium text-xs text-muted-foreground">
                                                Ưu tiên
                                            </th>
                                            <th className="px-4 py-2 min-w-[120px] font-medium text-xs text-muted-foreground">
                                                Độ khó
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {statusFilteredTasks.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="px-4 py-6 text-center text-sm text-muted-foreground"
                                                >
                                                    Chưa có task nào phù hợp
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedStatusTasks.map((task) => (
                                                <tr
                                                    key={task.id}
                                                    className="cursor-pointer hover:bg-muted/60 border-b last:border-0"
                                                    onClick={() => handleTaskClick(String(task.id))}
                                                >
                                                    <td className="px-4 py-2 text-xs text-muted-foreground">
                                                        {task.id}
                                                    </td>
                                                    <td className="px-4 py-2 font-medium">
                                                        {task.title}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-xs",
                                                                task.status === 'Done'
                                                                    ? "bg-green-100 text-green-800"
                                                                    : task.status === 'In Progress'
                                                                        ? "bg-blue-100 text-blue-800"
                                                                        : "bg-gray-100 text-gray-800"
                                                            )}
                                                        >
                                                            {task.status === 'To Do'
                                                                ? 'Chưa Làm'
                                                                : task.status === 'In Progress'
                                                                    ? 'Đang Làm'
                                                                    : 'Hoàn Thành'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-xs",
                                                                task.priority === 'High'
                                                                    ? "bg-red-100 text-red-800"
                                                                    : task.priority === 'Medium'
                                                                        ? "bg-yellow-100 text-yellow-800"
                                                                        : "bg-gray-100 text-gray-800"
                                                            )}
                                                        >
                                                            {task.priority}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn("text-xs bg-slate-100 text-slate-800")}
                                                        >
                                                            {getDifficultyLabel((task as any).difficulty)}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Phân trang cho bảng */}
                            {statusFilteredTasks.length > 0 && (
                                <div className="flex flex-col items-center gap-3 px-4 py-3 border-t bg-muted/40">
                                    <Pagination>
                                        <PaginationContent className="gap-2">
                                            <PaginationItem>
                                                <PaginationPrevious
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (taskPage > 1) {
                                                            setTaskPage(taskPage - 1);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "min-w-[90px] h-8 text-xs",
                                                        taskPage === 1
                                                            ? "pointer-events-none opacity-50 cursor-not-allowed"
                                                            : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                    )}
                                                />
                                            </PaginationItem>

                                            {Array.from({ length: totalTaskPages }, (_, i) => i + 1).map((page) => {
                                                if (
                                                    page === 1 ||
                                                    page === totalTaskPages ||
                                                    (page >= taskPage - 1 && page <= taskPage + 1)
                                                ) {
                                                    return (
                                                        <PaginationItem key={page}>
                                                            <PaginationLink
                                                                href="#"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setTaskPage(page);
                                                                }}
                                                                isActive={taskPage === page}
                                                                className={cn(
                                                                    "min-w-[32px] h-8 text-xs flex items-center justify-center",
                                                                    taskPage === page
                                                                        ? "bg-primary text-primary-foreground font-semibold"
                                                                        : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                                )}
                                                            >
                                                                {page}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    );
                                                } else if (page === taskPage - 2 || page === taskPage + 2) {
                                                    return (
                                                        <PaginationItem key={page}>
                                                            <span className="px-1 py-1 text-muted-foreground text-xs">...</span>
                                                        </PaginationItem>
                                                    );
                                                }
                                                return null;
                                            })}

                                            <PaginationItem>
                                                <PaginationNext
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (taskPage < totalTaskPages) {
                                                            setTaskPage(taskPage + 1);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "min-w-[90px] h-8 text-xs",
                                                        taskPage === totalTaskPages
                                                            ? "pointer-events-none opacity-50 cursor-not-allowed"
                                                            : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                    )}
                                                />
                                            </PaginationItem>
                                        </PaginationContent>
                                    </Pagination>

                                    <div className="text-xs text-muted-foreground">
                                        Trang {taskPage} / {totalTaskPages} • Hiển thị{" "}
                                        {(taskPage - 1) * TASKS_PER_PAGE_TABLE + 1}
                                        -
                                        {Math.min(taskPage * TASKS_PER_PAGE_TABLE, statusFilteredTasks.length)}{" "}
                                        trong tổng số {statusFilteredTasks.length} task
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Archived Tasks giữ nguyên */}
                        {filteredArchivedTasks.length > 0 && (
                            <div className="border rounded-lg overflow-hidden mt-4">
                                <div className="flex items-center gap-2 px-4 py-3 bg-muted/50">
                                    <Archive className="size-4 text-muted-foreground" />
                                    <h2 className="text-lg font-semibold flex-1">
                                        Đã Lưu Trữ
                                    </h2>
                                    <Badge variant="outline" className="ml-auto">
                                        {filteredArchivedTasks.length}{" "}
                                        {filteredArchivedTasks.length === 1 ? "task" : "tasks"}
                                    </Badge>
                                </div>
                                <div className="p-4">
                                    <ArchivedTaskColumn
                                        title="Task Đã Lưu Trữ"
                                        tasks={filteredArchivedTasks}
                                        onTaskClick={handleTaskClick}
                                        onUnarchive={handleUnarchiveTask}
                                        isArchiving={isArchiving}
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>


            {/* Create Task Dialog */}
            <CreateTaskDialog
                open={isCreateTask}
                onOpenChange={setIsCreateTask}
                projectId={projectId!}
                projectMembers={(project as any)?.members || []}
            />

            {/* AI Prediction Dialog — Premium */}
            <Dialog open={isPredictionDialogOpen} onOpenChange={setIsPredictionDialogOpen}>
                <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto p-0">
                    {/* Gradient Header */}
                    <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-6 py-5 rounded-t-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-white text-lg">
                                <BrainCircuit className="size-6" />
                                Đánh giá Rủi ro Dự án (AI)
                            </DialogTitle>
                            <DialogDescription className="text-white/80 text-sm">
                                Kết quả phân tích dựa trên thuật toán Random Forest — Đánh giá mô hình chi tiết
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {predictionResult?.prediction && (
                        <div className="space-y-5 px-6 py-5">

                            {/* ── 1. Risk Level ── */}
                            <div className="flex items-center justify-center p-5 rounded-xl border-2 shadow-sm" style={{
                                borderColor: predictionResult.prediction.risk_level === 'High' ? '#ef4444' : predictionResult.prediction.risk_level === 'Medium' ? '#f59e0b' : '#22c55e',
                                background: predictionResult.prediction.risk_level === 'High' ? 'linear-gradient(135deg,#fef2f2,#fee2e2)' : predictionResult.prediction.risk_level === 'Medium' ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : 'linear-gradient(135deg,#f0fdf4,#dcfce7)'
                            }}>
                                <div className="text-center">
                                    {predictionResult.prediction.risk_level === 'High' ? <ShieldAlert className="size-12 text-red-500 mx-auto mb-2" /> : predictionResult.prediction.risk_level === 'Medium' ? <AlertTriangle className="size-12 text-amber-500 mx-auto mb-2" /> : <ShieldCheck className="size-12 text-green-500 mx-auto mb-2" />}
                                    <p className="text-xl font-bold" style={{ color: predictionResult.prediction.risk_level === 'High' ? '#dc2626' : predictionResult.prediction.risk_level === 'Medium' ? '#d97706' : '#16a34a' }}>
                                        {predictionResult.prediction.risk_level === 'High' ? 'Rủi ro CAO — Có nguy cơ trễ hạn' : predictionResult.prediction.risk_level === 'Medium' ? 'Rủi ro TRUNG BÌNH — Cần chú ý' : 'Rủi ro THẤP — Tiến độ ổn định'}
                                    </p>
                                    {predictionResult.prediction.model_evaluation?.prediction_confidence && (
                                        <p className="text-sm mt-1 font-medium" style={{ color: predictionResult.prediction.risk_level === 'High' ? '#b91c1c' : predictionResult.prediction.risk_level === 'Medium' ? '#b45309' : '#15803d' }}>
                                            Độ tin cậy dự đoán: {predictionResult.prediction.model_evaluation.prediction_confidence.confidence_percent}%
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* ── 2. Prediction Confidence Breakdown ── */}
                            {predictionResult.prediction.model_evaluation?.prediction_confidence && (
                                <div className="rounded-xl border p-4 bg-gradient-to-br from-background to-muted/20 shadow-sm">
                                    <p className="text-sm font-semibold flex items-center gap-2 mb-3">
                                        <Target className="size-4 text-violet-500" />
                                        Xác suất từng mức rủi ro (lần dự đoán này)
                                    </p>
                                    <div className="space-y-2">
                                        {Object.entries(predictionResult.prediction.model_evaluation.prediction_confidence.probabilities).map(([label, prob]) => {
                                            const pct = Math.round(prob * 100);
                                            const color = label === 'High' ? '#ef4444' : label === 'Medium' ? '#f59e0b' : '#22c55e';
                                            const isPredicted = label === predictionResult.prediction.model_evaluation?.prediction_confidence.predicted_class;
                                            const ringClass = label === 'High' ? 'ring-red-500' : label === 'Medium' ? 'ring-amber-500' : 'ring-green-500';
                                            return (
                                                <div key={label} className={cn("rounded-lg p-2 transition-all", isPredicted ? `ring-2 ring-offset-1 bg-muted/40 ${ringClass}` : "")}>
                                                    <div className="flex items-center justify-between text-xs mb-1">
                                                        <span className="font-medium">{label === 'Low' ? '🟢 Thấp' : label === 'Medium' ? '🟡 Trung bình' : '🔴 Cao'} {isPredicted && '← Dự đoán'}</span>
                                                        <span className="font-bold">{pct}%</span>
                                                    </div>
                                                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}



                            {/* ── 7. Input Summary ── */}
                            <div className="rounded-xl border p-4 bg-muted/30 shadow-sm">
                                <p className="text-xs font-semibold mb-2 text-muted-foreground">📋 Dữ liệu đầu vào (tại thời điểm phân tích)</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                    <span>Thành viên: <strong>{predictionResult.prediction.input_summary.team_size}</strong></span>
                                    <span>Tổng task: <strong>{predictionResult.prediction.input_summary.total_tasks}</strong></span>
                                    <span>Thời gian đã qua: <strong>{Math.round(predictionResult.prediction.input_summary.elapsed_time_ratio * 100)}%</strong></span>
                                    <span>Hoàn thành: <strong>{Math.round(predictionResult.prediction.input_summary.task_completion_ratio * 100)}%</strong></span>
                                    <span>Task quá hạn: <strong className="text-red-600">{predictionResult.prediction.input_summary.overdue_tasks_count}</strong></span>
                                    <span>Task khó còn lại: <strong className="text-orange-600">{predictionResult.prediction.input_summary.remaining_hard_tasks}</strong></span>
                                </div>
                            </div>

                            {/* ── 8. Suggestions ── */}
                            <div className="space-y-3">
                                <p className="text-sm font-semibold flex items-center gap-1.5">
                                    <Lightbulb className="size-4 text-amber-500" />
                                    Nguyên nhân & Gợi ý hành động
                                </p>
                                {predictionResult.prediction.suggestions.map((s, idx) => (
                                    <div key={idx} className="rounded-xl border p-3 space-y-1.5 hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium text-foreground">{s.description}</p>
                                            <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                                                Ảnh hưởng: {Math.round(s.importance * 100)}%
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-primary bg-primary/5 rounded-lg p-2.5">
                                            💡 {s.suggestion}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
};

export default ProjectDetails;

interface TaskColumnProps {
    title: string;
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    isFullWidth?: boolean;
}

const TASKS_PER_PAGE = 3; // Maximum 3 tasks per page

const TaskColumn = ({ title, tasks, onTaskClick, isFullWidth = false }: TaskColumnProps) => {
    const [currentPage, setCurrentPage] = useState(1);

    // Paginate for both kanban and full width modes
    const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);
    const startIndex = (currentPage - 1) * TASKS_PER_PAGE;
    const endIndex = startIndex + TASKS_PER_PAGE;
    const paginatedTasks = tasks.slice(startIndex, endIndex);

    // Reset to page 1 when tasks change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [tasks.length]);

    // Kanban mode: fixed width column with horizontal task layout and pagination
    if (!isFullWidth) {
        return (
            <div className="flex-shrink-0 w-full sm:w-[320px] flex flex-col bg-muted/30 rounded-lg border shadow-sm">
                {/* Column Header */}
                <div className='flex items-center justify-between px-4 py-3 border-b bg-background/50 rounded-t-lg'>
                    <h1 className='font-semibold text-sm'>{title}</h1>
                    <Badge variant="outline" className="text-xs">{tasks?.length}</Badge>
                </div>

                {/* Tasks Container - Horizontal Layout */}
                <div className="flex-1 px-3 py-3 min-h-[400px] flex flex-col">
                    {tasks.length === 0 ? (
                        <div className='text-center text-sm text-muted-foreground py-8 flex-1 flex items-center justify-center'>
                            Chưa có task nào
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-x-auto pb-3 w-full" style={{ scrollbarWidth: 'thin' }}>
                                <div className="flex gap-3 min-w-max">
                                    {paginatedTasks.map((task) => (
                                        <div key={task.id} className="w-[280px] flex-shrink-0">
                                            <TaskCard
                                                task={task}
                                                onClick={() => onTaskClick(task.id)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pagination */}
                            {tasks.length > 0 && (
                                <div className="mt-3 pt-3 border-t flex flex-col items-center gap-2">
                                    <Pagination>
                                        <PaginationContent className="gap-1">
                                            <PaginationItem>
                                                <PaginationPrevious
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (currentPage > 1) {
                                                            setCurrentPage(currentPage - 1);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "min-w-[80px] h-8 text-xs",
                                                        currentPage === 1
                                                            ? "pointer-events-none opacity-50 cursor-not-allowed"
                                                            : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                    )}
                                                />
                                            </PaginationItem>

                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                                if (
                                                    page === 1 ||
                                                    page === totalPages ||
                                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <PaginationItem key={page}>
                                                            <PaginationLink
                                                                href="#"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setCurrentPage(page);
                                                                }}
                                                                isActive={currentPage === page}
                                                                className={cn(
                                                                    "min-w-[32px] h-8 text-xs flex items-center justify-center",
                                                                    currentPage === page
                                                                        ? "bg-primary text-primary-foreground font-semibold"
                                                                        : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                                )}
                                                            >
                                                                {page}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    );
                                                } else if (page === currentPage - 2 || page === currentPage + 2) {
                                                    return (
                                                        <PaginationItem key={page}>
                                                            <span className="px-1 py-1 text-muted-foreground text-xs">...</span>
                                                        </PaginationItem>
                                                    );
                                                }
                                                return null;
                                            })}

                                            <PaginationItem>
                                                <PaginationNext
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (currentPage < totalPages) {
                                                            setCurrentPage(currentPage + 1);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "min-w-[80px] h-8 text-xs",
                                                        currentPage === totalPages
                                                            ? "pointer-events-none opacity-50 cursor-not-allowed"
                                                            : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                    )}
                                                />
                                            </PaginationItem>
                                        </PaginationContent>
                                    </Pagination>

                                    <div className="text-xs text-muted-foreground">
                                        Trang {currentPage}/{totalPages}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Full width mode: horizontal layout with pagination
    return (
        <div className="space-y-4">
            <div className='flex items-center justify-between'>
                <h1 className='font-medium text-lg'>{title}</h1>
                <Badge variant="outline">{tasks?.length}</Badge>
            </div>

            {tasks.length === 0 ? (
                <div className='text-center text-sm text-muted-foreground py-12 bg-muted/30 rounded-lg'>
                    Chưa có task nào
                </div>
            ) : (
                <>
                    {/* Horizontal Scrollable Tasks */}
                    <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
                        <div className="flex gap-4 min-w-max">
                            {paginatedTasks.map((task) => (
                                <div key={task.id} className="w-[300px] md:w-[320px] flex-shrink-0">
                                    <TaskCard
                                        task={task}
                                        onClick={() => onTaskClick(task.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pagination */}
                    {tasks.length > 0 && (
                        <div className="flex flex-col items-center gap-4 pt-4 border-t">
                            <Pagination>
                                <PaginationContent className="gap-2">
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (currentPage > 1) {
                                                    setCurrentPage(currentPage - 1);
                                                }
                                            }}
                                            className={cn(
                                                "min-w-[100px]",
                                                currentPage === 1
                                                    ? "pointer-events-none opacity-50 cursor-not-allowed"
                                                    : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                            )}
                                        />
                                    </PaginationItem>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                        if (
                                            page === 1 ||
                                            page === totalPages ||
                                            (page >= currentPage - 1 && page <= currentPage + 1)
                                        ) {
                                            return (
                                                <PaginationItem key={page}>
                                                    <PaginationLink
                                                        href="#"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setCurrentPage(page);
                                                        }}
                                                        isActive={currentPage === page}
                                                        className={cn(
                                                            "min-w-[40px] h-10 flex items-center justify-center",
                                                            currentPage === page
                                                                ? "bg-primary text-primary-foreground font-semibold"
                                                                : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                        )}
                                                    >
                                                        {page}
                                                    </PaginationLink>
                                                </PaginationItem>
                                            );
                                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                                            return (
                                                <PaginationItem key={page}>
                                                    <span className="px-2 py-2 text-muted-foreground">...</span>
                                                </PaginationItem>
                                            );
                                        }
                                        return null;
                                    })}

                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (currentPage < totalPages) {
                                                    setCurrentPage(currentPage + 1);
                                                }
                                            }}
                                            className={cn(
                                                "min-w-[100px]",
                                                currentPage === totalPages
                                                    ? "pointer-events-none opacity-50 cursor-not-allowed"
                                                    : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                            )}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>

                            {/* Results info */}
                            <div className="text-sm text-muted-foreground">
                                Trang {currentPage} / {totalPages} • Hiển thị {startIndex + 1}-{Math.min(endIndex, tasks.length)} trong tổng số {tasks.length} task
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

interface TaskStatusGroupProps {
    status: string;
    statusLabel: string;
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    expandedStatuses: Record<string, boolean>;
    statusPages: Record<string, number>;
    onToggle: (status: string) => void;
    onPageChange: (status: string, page: number) => void;
}

const TASKS_PER_PAGE_STATUS = 3;

const TaskStatusGroup = ({
    status,
    statusLabel,
    tasks,
    onTaskClick,
    expandedStatuses,
    statusPages,
    onToggle,
    onPageChange
}: TaskStatusGroupProps) => {
    const isExpanded = expandedStatuses[status] !== false;
    const currentPage = statusPages[status] || 1;

    const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE_STATUS);
    const startIndex = (currentPage - 1) * TASKS_PER_PAGE_STATUS;
    const endIndex = startIndex + TASKS_PER_PAGE_STATUS;
    const paginatedTasks = tasks.slice(startIndex, endIndex);

    const getStatusIcon = () => {
        switch (status) {
            case 'To Do':
                return '📋';
            case 'In Progress':
                return '🔄';
            case 'Done':
                return '✅';
            default:
                return '📝';
        }
    };

    return (
        <div className="border rounded-lg w-full">
            {/* Status Header - Clickable */}
            <div
                className="flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer"
                onClick={() => onToggle(status)}
            >
                {isExpanded ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                )}
                <span className="text-lg">{getStatusIcon()}</span>
                <h2 className="text-lg font-semibold flex-1">{statusLabel}</h2>
                <Badge variant="outline" className="ml-auto">
                    {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                </Badge>
            </div>

            {/* Tasks Grid - Collapsible */}
            {isExpanded && (
                <div className="p-4 pt-3 space-y-4 w-full">
                    {tasks.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">Chưa có task nào</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                                {paginatedTasks.map((task: Task) => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onClick={() => onTaskClick(task.id)}
                                    />
                                ))}
                            </div>

                            {/* Pagination */}
                            {tasks.length > 0 && (
                                <div className="flex flex-col items-center gap-3 pt-2 border-t">
                                    <Pagination>
                                        <PaginationContent className="gap-2">
                                            <PaginationItem>
                                                <PaginationPrevious
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (currentPage > 1) {
                                                            onPageChange(status, currentPage - 1);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "min-w-[100px]",
                                                        currentPage === 1
                                                            ? "pointer-events-none opacity-50 cursor-not-allowed"
                                                            : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                    )}
                                                />
                                            </PaginationItem>

                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                                if (
                                                    page === 1 ||
                                                    page === totalPages ||
                                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <PaginationItem key={page}>
                                                            <PaginationLink
                                                                href="#"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    onPageChange(status, page);
                                                                }}
                                                                isActive={currentPage === page}
                                                                className={cn(
                                                                    "min-w-[40px] h-10 flex items-center justify-center",
                                                                    currentPage === page
                                                                        ? "bg-primary text-primary-foreground font-semibold"
                                                                        : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                                )}
                                                            >
                                                                {page}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    );
                                                } else if (page === currentPage - 2 || page === currentPage + 2) {
                                                    return (
                                                        <PaginationItem key={page}>
                                                            <span className="px-2 py-2 text-muted-foreground">...</span>
                                                        </PaginationItem>
                                                    );
                                                }
                                                return null;
                                            })}

                                            <PaginationItem>
                                                <PaginationNext
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (currentPage < totalPages) {
                                                            onPageChange(status, currentPage + 1);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "min-w-[100px]",
                                                        currentPage === totalPages
                                                            ? "pointer-events-none opacity-50 cursor-not-allowed"
                                                            : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                    )}
                                                />
                                            </PaginationItem>
                                        </PaginationContent>
                                    </Pagination>

                                    {/* Results info */}
                                    <div className="text-xs text-muted-foreground">
                                        Trang {currentPage} / {totalPages} • Hiển thị {startIndex + 1}-{Math.min(endIndex, tasks.length)} trong tổng số {tasks.length} task
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

interface ArchivedTaskColumnProps {
    title: string;
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    onUnarchive: (taskId: string, e: React.MouseEvent) => void;
    isArchiving: boolean;
}

const ARCHIVED_TASKS_PER_PAGE = 3; // Maximum 3 tasks per page

const ArchivedTaskColumn = ({ title, tasks, onTaskClick, onUnarchive, isArchiving }: ArchivedTaskColumnProps) => {
    const [currentPage, setCurrentPage] = useState(1);

    // Pagination for archived tasks
    const totalPages = Math.ceil(tasks.length / ARCHIVED_TASKS_PER_PAGE);
    const startIndex = (currentPage - 1) * ARCHIVED_TASKS_PER_PAGE;
    const endIndex = startIndex + ARCHIVED_TASKS_PER_PAGE;
    const paginatedTasks = tasks.slice(startIndex, endIndex);

    // Reset to page 1 when tasks change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [tasks.length]);

    return (
        <div className="space-y-4">
            <div className='flex items-center justify-between'>
                <h1 className='font-medium'>{title}</h1>
                <Badge variant="outline">{tasks?.length}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {
                    paginatedTasks.length === 0 ? (
                        <div className='text-center text-sm text-muted-foreground col-span-full py-8'>
                            Không có task đã lưu trữ
                        </div>
                    ) : (
                        paginatedTasks.map((task) => (
                            <div key={task.id} className="relative">
                                <TaskCard
                                    task={task}
                                    onClick={() => onTaskClick(task.id)}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="absolute top-2 right-2 z-10"
                                    onClick={(e) => onUnarchive(task.id, e)}
                                    disabled={isArchiving}
                                >
                                    <Archive className="size-4 mr-2" />
                                    Bỏ Lưu Trữ
                                </Button>
                            </div>
                        ))
                    )
                }
            </div>

            {/* Pagination for archived tasks */}
            {tasks.length > 0 && (
                <div className="mt-4 flex flex-col items-center gap-3 pt-3 border-t">
                    <Pagination>
                        <PaginationContent className="gap-2">
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (currentPage > 1) {
                                            setCurrentPage(currentPage - 1);
                                        }
                                    }}
                                    className={cn(
                                        "min-w-[100px]",
                                        currentPage === 1
                                            ? "pointer-events-none opacity-50 cursor-not-allowed"
                                            : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                    )}
                                />
                            </PaginationItem>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                if (
                                    page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                ) {
                                    return (
                                        <PaginationItem key={page}>
                                            <PaginationLink
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setCurrentPage(page);
                                                }}
                                                isActive={currentPage === page}
                                                className={cn(
                                                    "min-w-[40px] h-10 flex items-center justify-center",
                                                    currentPage === page
                                                        ? "bg-primary text-primary-foreground font-semibold"
                                                        : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                                )}
                                            >
                                                {page}
                                            </PaginationLink>
                                        </PaginationItem>
                                    );
                                } else if (page === currentPage - 2 || page === currentPage + 2) {
                                    return (
                                        <PaginationItem key={page}>
                                            <span className="px-2 py-2 text-muted-foreground">...</span>
                                        </PaginationItem>
                                    );
                                }
                                return null;
                            })}

                            <PaginationItem>
                                <PaginationNext
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (currentPage < totalPages) {
                                            setCurrentPage(currentPage + 1);
                                        }
                                    }}
                                    className={cn(
                                        "min-w-[100px]",
                                        currentPage === totalPages
                                            ? "pointer-events-none opacity-50 cursor-not-allowed"
                                            : "hover:bg-accent hover:text-accent-foreground transition-colors"
                                    )}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>

                    {/* Results info */}
                    <div className="text-xs text-muted-foreground">
                        Trang {currentPage} / {totalPages} • Hiển thị {startIndex + 1}-{Math.min(endIndex, tasks.length)} trong tổng số {tasks.length} task
                    </div>
                </div>
            )}
        </div>
    )
}

