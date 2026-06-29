import React, { useMemo, useState } from 'react'
import { useQuery } from "@tanstack/react-query"
import { fetchData } from "@/lib/fetch-utlis"
import { Loader } from "../../components/loader";
import type { Task } from "@/type";
import { useSearchParams, useNavigate } from "react-router";
import { NoDataFound } from "@/components/workspace/no-data-found";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format, addDays, endOfDay, isPast, isToday, startOfDay } from "date-fns";
import { useGetWorkspaceQueryById } from "@/hooks/use-workspace";

const TASKS_PER_PAGE = 10; // Global pagination

const MyTasks = () => {
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspaceId');
  const navigate = useNavigate();
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data: workspaceData } = useGetWorkspaceQueryById(workspaceId || "");
  const [statusFilter, setStatusFilter] = useState<"All" | "To Do" | "In Progress" | "Done">("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | "Low" | "Medium" | "High">("All");
  const [dueFilter, setDueFilter] = useState<
    "All" | "No due date" | "Overdue" | "Today" | "Next 7 days" | "Next 30 days"
  >("All");

  const { data, isPending, error } = useQuery({
    queryKey: ["my-tasks", workspaceId],
    queryFn: async () => {
      try {
        const response = await fetchData(`/task/my-tasks?workspaceId=${workspaceId}`);
        // Check if response has error
        if ((response as any)?.err === 1 || (response as any)?.err === -1) {
          const errorMsg = (response as any)?.msg || 'Failed to fetch tasks';
          console.error("API returned error:", response);
          throw new Error(errorMsg);
        }
        // Ensure response has the expected structure
        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response format from server');
        }
        return response;
      } catch (err: any) {
        console.error("Error fetching tasks:", err);
        // Extract error message from response if available
        let errorMsg = 'Không thể tải tasks';
        if (err?.response?.data?.msg) {
          errorMsg = err.response.data.msg;
        } else if (err?.message) {
          errorMsg = err.message;
        }
        const errorObj = new Error(errorMsg);
        // Preserve original error for debugging
        (errorObj as any).originalError = err;
        (errorObj as any).response = err?.response;
        throw errorObj;
      }
    },
    enabled: !!workspaceId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  }) as {
    data: {
      response: Task[];
    };
    isPending: boolean;
    error: any;
  };

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!data?.response) return [];
    
    const query = taskSearchQuery.trim().toLowerCase();
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const next7End = endOfDay(addDays(todayStart, 7));
    const next30End = endOfDay(addDays(todayStart, 30));

    return data.response
      .filter((task: Task) => {
        if (!query) return true;
        const title = (task.title || "").toLowerCase();
        const description = (task.description || "").toLowerCase();
        return title.includes(query) || description.includes(query);
      })
      .filter((task: Task) => {
        if (statusFilter === "All") return true;
        return task.status === statusFilter;
      })
      .filter((task: Task) => {
        if (priorityFilter === "All") return true;
        return task.priority === priorityFilter;
      })
      .filter((task: Task) => {
        if (dueFilter === "All") return true;
        const due = task.dueDate ? new Date(task.dueDate) : null;

        if (dueFilter === "No due date") return !due;
        if (!due) return false;

        // Normalize by checking day boundaries
        if (dueFilter === "Today") return due >= todayStart && due <= todayEnd;
        if (dueFilter === "Overdue") return isPast(due) && !isToday(due);
        if (dueFilter === "Next 7 days") return due >= todayStart && due <= next7End;
        if (dueFilter === "Next 30 days") return due >= todayStart && due <= next30End;
        return true;
      });
  }, [data?.response, taskSearchQuery, statusFilter, priorityFilter, dueFilter]);



  React.useEffect(() => {
    setPage(1);
  }, [workspaceId, taskSearchQuery, statusFilter, priorityFilter, dueFilter]);

  if (!workspaceId) {
    return (
      <div className="h-full p-4 flex flex-col overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold">Task Của Tôi</h1>
            <p className="text-sm text-muted-foreground">Vui lòng chọn không gian làm việc để xem task.</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <NoDataFound
              title="Chưa chọn không gian làm việc"
              description="Vui lòng chọn một workspace ở thanh trên hoặc truy cập danh sách để bắt đầu xem nhiệm vụ của bạn."
              buttonText="Đi tới không gian làm việc"
              buttonAction={() => navigate("/workspaces")}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Task Của Tôi</h1>
        <Loader />
      </div>
    );
  }

  if (error) {
    const errorMessage = error?.message || error?.response?.data?.msg || 'Không thể tải tasks';
    const errorDetails = error?.response?.data || error?.originalError?.response?.data || {};
    
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Task Của Tôi</h1>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive font-medium">Lỗi khi tải tasks</p>
          <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
          {Object.keys(errorDetails).length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer">Chi tiết lỗi</summary>
              <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-40">
                {JSON.stringify(errorDetails, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  const tasks = data?.response || [];
  const workspaceName = (workspaceData as any)?.name || "Workspace";

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PER_PAGE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * TASKS_PER_PAGE;
  const endIndex = startIndex + TASKS_PER_PAGE;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  if (tasks.length === 0) {
    return (
      <div className="h-full p-4 flex flex-col overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold">Task Của Tôi</h1>
            <p className="text-sm text-muted-foreground">
              Workspace: <span className="font-medium text-foreground">{workspaceName}</span>
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <NoDataFound
              title="Bạn chưa có task nào trong không gian này"
              description="Hiện tại không gian làm việc này chưa có nhiệm vụ nào được giao cho bạn."
              buttonText="Đi tới danh sách dự án"
              buttonAction={() => navigate(`/workspaces/${workspaceId}`)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 flex flex-col overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Task Của Tôi</h1>
          <p className="text-sm text-muted-foreground">
            Workspace: <span className="font-medium text-foreground">{workspaceName}</span>
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {filteredTasks.length} task
        </Badge>
      </div>

      <div className="space-y-4 flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Search Bar */}
        <div className='p-4 bg-muted/30 rounded-lg border space-y-3'>
          <div className='relative'>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm task..."
              value={taskSearchQuery}
              onChange={(e) => setTaskSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Tất cả trạng thái</SelectItem>
                <SelectItem value="To Do">Chưa làm</SelectItem>
                <SelectItem value="In Progress">Đang làm</SelectItem>
                <SelectItem value="Done">Hoàn thành</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Ưu tiên" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Tất cả ưu tiên</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dueFilter} onValueChange={(v) => setDueFilter(v as any)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Hạn chót" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Tất cả hạn chót</SelectItem>
                <SelectItem value="Overdue">Quá hạn</SelectItem>
                <SelectItem value="Today">Hôm nay</SelectItem>
                <SelectItem value="Next 7 days">7 ngày tới</SelectItem>
                <SelectItem value="Next 30 days">30 ngày tới</SelectItem>
                <SelectItem value="No due date">Không có hạn</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="bg-white"
              onClick={() => {
                setStatusFilter("All");
                setPriorityFilter("All");
                setDueFilter("All");
              }}
              disabled={statusFilter === "All" && priorityFilter === "All" && dueFilter === "All"}
            >
              Xóa lọc
            </Button>
          </div>
        </div>

        <div className="space-y-3 flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Mobile View: Cards */}
          <div className="block md:hidden flex-1 min-h-0 overflow-auto space-y-3 p-1">
            {paginatedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg border-border/60 bg-white">
                <Search className="size-8 text-muted-foreground mb-3 opacity-60" />
                <h3 className="font-semibold text-base">Không tìm thấy kết quả</h3>
                <p className="text-sm text-muted-foreground max-w-xs mt-1 px-4">
                  Không tìm thấy nhiệm vụ phù hợp với bộ lọc hoặc từ khóa "{taskSearchQuery}".
                </p>
              </div>
            ) : (
              paginatedTasks.map((task: Task) => {
                const project = typeof task.project === "object" ? (task.project as any) : null;
                const projectName = project?.name || "Không xác định";
                const projectIdForNav = project?.id || "unknown";
                return (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg border p-4 shadow-sm hover:border-blue-500 transition-colors cursor-pointer space-y-3"
                    onClick={() => {
                      if (workspaceId && projectIdForNav !== "unknown") {
                        navigate(`/workspaces/${workspaceId}/projects/${projectIdForNav}/tasks/${task.id}`);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-slate-900 line-clamp-1">{task.title}</h3>
                        <div className="text-xs text-slate-500">
                          <span>{workspaceName}</span>
                          <span className="mx-1">&gt;</span>
                          <span className="font-medium text-slate-700">{projectName}</span>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "shrink-0",
                          task.status === "To Do"
                            ? "bg-slate-100 text-slate-700 border border-slate-200"
                            : task.status === "In Progress"
                              ? "bg-blue-100 text-blue-700 border border-blue-200"
                              : "bg-green-100 text-green-700 border border-green-200"
                        )}
                      >
                        {task.status === "To Do" ? "Chưa Làm" : task.status === "In Progress" ? "Đang Làm" : "Hoàn Thành"}
                      </Badge>
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2 border-t items-center justify-between text-xs">
                      <div className="flex gap-1.5">
                        <Badge
                          className={
                            task.priority === "High"
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : task.priority === "Medium"
                                ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                          }
                        >
                          {task.priority}
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                          {(task as any).difficulty === "Easy"
                            ? "Dễ"
                            : (task as any).difficulty === "Hard"
                              ? "Khó"
                              : "Trung bình"}
                        </Badge>
                      </div>
                      <div className="text-slate-500 font-mono">
                        Hạn: {task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : "—"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block flex-1 min-h-0 overflow-auto rounded-lg border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-700 w-[28%]">
                    Workspace &gt; Project
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700 w-[36%]">Task</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Trạng thái</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Ưu tiên</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Độ khó</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">Hạn chót</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Search className="size-8 text-muted-foreground mb-3 opacity-60" />
                        <h3 className="font-semibold text-base">Không tìm thấy kết quả</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mt-1 px-4">
                          Không tìm thấy nhiệm vụ phù hợp với bộ lọc hoặc từ khóa "{taskSearchQuery}".
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedTasks.map((task: Task) => {
                    const project = typeof task.project === "object" ? (task.project as any) : null;
                    const projectName = project?.name || "Không xác định";
                    const projectIdForNav = project?.id || "unknown";
                    return (
                      <tr
                        key={task.id}
                        className="border-t hover:bg-muted/60 cursor-pointer"
                        onClick={() => {
                          if (workspaceId && projectIdForNav !== "unknown") {
                            navigate(`/workspaces/${workspaceId}/projects/${projectIdForNav}/tasks/${task.id}`);
                          }
                        }}
                      >
                        <td className="px-4 py-2 align-top">
                          <div className="text-xs text-slate-700">
                            <span className="font-medium">{workspaceName}</span>
                            <span className="text-slate-400"> &gt; </span>
                            <span className="truncate">{projectName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-slate-900">{task.title}</span>
                            {task.description && (
                              <span className="text-xs text-slate-500 line-clamp-2">{task.description}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <Badge
                            className={
                              task.status === "To Do"
                                ? "bg-slate-100 text-slate-700 border border-slate-200"
                                : task.status === "In Progress"
                                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                                  : "bg-green-100 text-green-700 border border-green-200"
                            }
                          >
                            {task.status === "To Do" ? "Chưa Làm" : task.status === "In Progress" ? "Đang Làm" : "Hoàn Thành"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <Badge
                            className={
                              task.priority === "High"
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : task.priority === "Medium"
                                  ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                            }
                          >
                            {task.priority}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 align-top">
                          <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                            {(task as any).difficulty === "Easy"
                              ? "Dễ"
                              : (task as any).difficulty === "Hard"
                                ? "Khó"
                                : "Trung bình"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-700">
                          {task.dueDate ? format(new Date(task.dueDate), "dd/MM/yyyy") : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Global Pagination */}
          {filteredTasks.length > 0 && (
            <div className="flex flex-col items-center gap-3 pt-2 shrink-0">
              <Pagination>
                <PaginationContent className="gap-2">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (safePage > 1) setPage(safePage - 1);
                      }}
                      className={cn(
                        "min-w-[100px]",
                        safePage === 1
                          ? "pointer-events-none opacity-50 cursor-not-allowed"
                          : "hover:bg-accent hover:text-accent-foreground transition-colors"
                      )}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                    if (p === 1 || p === totalPages || (p >= safePage - 1 && p <= safePage + 1)) {
                      return (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(p);
                            }}
                            isActive={safePage === p}
                            className={cn(
                              "min-w-[40px] h-10 flex items-center justify-center",
                              safePage === p
                                ? "bg-primary text-primary-foreground font-semibold"
                                : "hover:bg-accent hover:text-accent-foreground transition-colors"
                            )}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                    if (p === safePage - 2 || p === safePage + 2) {
                      return (
                        <PaginationItem key={p}>
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
                        if (safePage < totalPages) setPage(safePage + 1);
                      }}
                      className={cn(
                        "min-w-[100px]",
                        safePage === totalPages
                          ? "pointer-events-none opacity-50 cursor-not-allowed"
                          : "hover:bg-accent hover:text-accent-foreground transition-colors"
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <div className="text-xs text-muted-foreground">
                Trang {safePage} / {totalPages} • Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredTasks.length)} trong tổng số{" "}
                {filteredTasks.length} task
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyTasks