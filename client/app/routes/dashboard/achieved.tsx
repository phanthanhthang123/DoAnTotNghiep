import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/fetch-utlis";
import { Loader } from "@/components/loader";
import type { Task } from "@/type";
import { useNavigate, useSearchParams } from "react-router";
import { NoDataFound } from "@/components/workspace/no-data-found";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";
import { useGetWorkspaceQueryById } from "@/hooks/use-workspace";

const TASKS_PER_PAGE = 10; // global

const Achieved = () => {
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");
  const navigate = useNavigate();

  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const { data: workspaceData } = useGetWorkspaceQueryById(workspaceId || "");

  const { data, isPending, error } = useQuery({
    queryKey: ["achieved", workspaceId],
    queryFn: async () => {
      const response = await fetchData(`/task/my-tasks?workspaceId=${workspaceId}`);
      if ((response as any)?.err === 1 || (response as any)?.err === -1) {
        throw new Error((response as any)?.msg || "Không thể tải tasks");
      }
      return response as { response: Task[] };
    },
    enabled: !!workspaceId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const doneTasks = useMemo(() => {
    const tasks = data?.response || [];
    return tasks.filter((t: any) => t?.status === "Done" && !t?.isArchived);
  }, [data?.response]);

  const filteredTasks = useMemo(() => {
    if (!taskSearchQuery.trim()) return doneTasks;
    const q = taskSearchQuery.toLowerCase();
    return doneTasks.filter((task: Task) => {
      const title = (task.title || "").toLowerCase();
      const desc = (task.description || "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [doneTasks, taskSearchQuery]);

  React.useEffect(() => {
    setPage(1);
  }, [workspaceId, taskSearchQuery]);

  if (!workspaceId) {
    return (
      <div className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Đã Hoàn Thành</h1>
            <p className="text-sm text-muted-foreground">Danh sách task bạn đã hoàn thành theo từng dự án.</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <NoDataFound
              title="Chưa chọn không gian làm việc"
              description="Vui lòng chọn một workspace ở thanh trên hoặc truy cập danh sách để xem các nhiệm vụ đã hoàn thành."
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
        <h1 className="text-2xl font-bold mb-6">Đã Hoàn Thành</h1>
        <Loader />
      </div>
    );
  }

  if (error) {
    const message = (error as any)?.message || (error as any)?.response?.data?.msg || "Không thể tải tasks";
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Đã Hoàn Thành</h1>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive font-medium">Lỗi khi tải tasks</p>
          <p className="text-xs text-muted-foreground mt-1">{message}</p>
        </div>
      </div>
    );
  }

  const workspaceName = (workspaceData as any)?.name || "Workspace";

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PER_PAGE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * TASKS_PER_PAGE;
  const endIndex = startIndex + TASKS_PER_PAGE;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  if (doneTasks.length === 0) {
    return (
      <div className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Đã Hoàn Thành</h1>
            <p className="text-sm text-muted-foreground">
              Workspace: <span className="font-medium text-foreground">{workspaceName}</span>
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-lg">
            <NoDataFound
              title="Chưa có task hoàn thành"
              description="Bạn chưa hoàn thành nhiệm vụ nào trong không gian làm việc này."
              buttonText="Xem danh sách dự án"
              buttonAction={() => navigate(`/workspaces/${workspaceId}`)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Đã Hoàn Thành</h1>
          <p className="text-sm text-muted-foreground">
            Workspace: <span className="font-medium text-foreground">{workspaceName}</span>
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {doneTasks.length} task
        </Badge>
      </div>

      {/* Search */}
      <div className="p-4 bg-muted/30 rounded-lg border mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm task đã hoàn thành..."
            value={taskSearchQuery}
            onChange={(e) => setTaskSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-3">
        {/* Mobile View: Cards */}
        <div className="block md:hidden space-y-3 p-1">
          {paginatedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg border-border/60 bg-white">
              <Search className="size-8 text-muted-foreground mb-3 opacity-60" />
              <h3 className="font-semibold text-base">Không tìm thấy kết quả</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1 px-4">
                Không tìm thấy nhiệm vụ đã hoàn thành phù hợp với từ khóa "{taskSearchQuery}".
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
                    <Badge className="bg-green-100 text-green-700 border border-green-200 shrink-0">
                      Hoàn Thành
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
        <div className="hidden md:block overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-700 w-[28%]">
                  Workspace &gt; Project
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-700 w-[42%]">Task</th>
                <th className="px-4 py-2 text-left font-medium text-slate-700">Ưu tiên</th>
                <th className="px-4 py-2 text-left font-medium text-slate-700">Độ khó</th>
                <th className="px-4 py-2 text-left font-medium text-slate-700">Hạn chót</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Search className="size-8 text-muted-foreground mb-3 opacity-60" />
                      <h3 className="font-semibold text-base">Không tìm thấy kết quả</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mt-1 px-4">
                        Không tìm thấy nhiệm vụ đã hoàn thành phù hợp với từ khóa "{taskSearchQuery}".
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{task.title}</span>
                            <Badge className="bg-green-100 text-green-700 border border-green-200">Hoàn Thành</Badge>
                          </div>
                          {task.description && (
                            <span className="text-xs text-slate-500 line-clamp-2">{task.description}</span>
                          )}
                        </div>
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

        {filteredTasks.length > 0 && (
          <div className="flex flex-col items-center gap-3 pt-2">
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
  );
};

export default Achieved;