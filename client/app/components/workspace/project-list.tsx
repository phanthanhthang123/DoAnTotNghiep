import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { NoDataFound } from "./no-data-found";
import { getProjectProgress, getProjectStatusLabel, getTaskStatusColor } from "@/lib";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useAuth } from "@/provider/auth-context";

const ITEMS_PER_PAGE = 12;

type ParticipationFilter = "all" | "joined" | "notJoined";

function userParticipatesInProject(project: any, userId: string | undefined): boolean {
  if (!userId) return false;
  if (project.leader_id != null && String(project.leader_id) === String(userId)) return true;
  if (project.created_by != null && String(project.created_by) === String(userId)) return true;
  const members = project.members || [];
  return members.some((m: { user_id?: string }) => String(m.user_id) === String(userId));
}

const ProjectList = (props: {
  workspaceId: string;
  projects: any[];
  isOpen: boolean;
  onCreateProject: () => void;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [participation, setParticipation] = useState<ParticipationFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProjects = useMemo(() => {
    let list = props.projects || [];

    if (participation === "joined") {
      list = list.filter((p) => userParticipatesInProject(p, user?.id));
    } else if (participation === "notJoined") {
      list = list.filter((p) => !userParticipatesInProject(p, user?.id));
    }

    if (!searchQuery.trim()) {
      return list;
    }
    const query = searchQuery.toLowerCase();
    return list.filter((project) => {
      const name = (project.name || "").toLowerCase();
      const description = (project.description || "").toLowerCase();
      return name.includes(query) || description.includes(query);
    });
  }, [props.projects, searchQuery, participation, user?.id]);

  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, participation]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h3 className="text-xl font-semibold shrink-0">Dự Án</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:flex-1 sm:min-w-0 sm:gap-3">
          <Select value={participation} onValueChange={(v) => setParticipation(v as ParticipationFilter)}>
            <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm">
              <SelectValue placeholder="Lọc theo tham gia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả dự án</SelectItem>
              <SelectItem value="joined">Đã tham gia (thành viên / leader)</SelectItem>
              <SelectItem value="notJoined">Chưa tham gia (chưa có trong dự án)</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:max-w-xs sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              type="text"
              placeholder="Tìm kiếm dự án..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <NoDataFound
          title={
            searchQuery.trim()
              ? "Không tìm thấy dự án phù hợp"
              : participation === "joined"
                ? "Không có dự án bạn đã tham gia"
                : participation === "notJoined"
                  ? "Không có dự án chưa tham gia"
                  : "Không tìm thấy dự án"
          }
          description={
            searchQuery.trim()
              ? "Thử tìm kiếm với từ khóa khác"
              : participation !== "all"
                ? "Đổi bộ lọc hoặc chọn “Tất cả dự án”."
                : "Tạo một dự án mới để bắt đầu"
          }
          buttonText="Tạo Dự Án"
          buttonAction={props.onCreateProject}
        />
      ) : (
        <>
          {/* Mobile View: Project Cards */}
          <div className="block md:hidden space-y-4">
            {paginatedProjects.map((project) => {
              const tasks = project.tasks || [];
              const projectProgress =
                tasks.length > 0 ? getProjectProgress(tasks) : project.progress || 0;
              const href = `/workspaces/${props.workspaceId}/projects/${project.id}`;
              const start = project?.start_date
                ? format(new Date(project.start_date), "dd/MM/yyyy")
                : "—";
              const end = project?.end_date
                ? format(new Date(project.end_date), "dd/MM/yyyy")
                : "—";

              const isOverdue =
                project.status !== 'Completed' &&
                project.end_date &&
                new Date(project.end_date) < new Date();

              return (
                <div
                  key={project.id}
                  className={cn(
                    "bg-white rounded-lg border p-4 shadow-sm hover:border-blue-500 transition-colors cursor-pointer space-y-3",
                    isOverdue && "border-red-200 bg-red-50/10 hover:border-red-500"
                  )}
                  onClick={() => navigate(href)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <h4 className="font-semibold text-slate-900 line-clamp-1">{project.name}</h4>
                        {isOverdue && (
                          <span className="bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 uppercase tracking-wide shrink-0">
                            Trễ hạn
                          </span>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{project.description}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shrink-0",
                        getTaskStatusColor(project.status)
                      )}
                    >
                      {getProjectStatusLabel(project.status)}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Tiến độ</span>
                      <span className="font-semibold text-slate-700">{projectProgress}%</span>
                    </div>
                    <Progress value={projectProgress} className="h-1.5 text-blue-600" />
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2 border-t text-slate-500">
                    <div>
                      Task: <span className="font-semibold text-slate-700">{project?.tasks?.length ?? 0}</span>
                    </div>
                    <div className={cn("font-mono text-[11px]", isOverdue ? "text-red-600 font-semibold" : "text-slate-500")}>
                      {start} → {end}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Project Table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] caption-bottom text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="h-9 px-3 text-left font-medium align-middle">Tên dự án</th>
                  <th className="h-9 px-2 text-left font-medium align-middle whitespace-nowrap">Trạng thái</th>
                  <th className="h-9 px-2 text-left font-medium align-middle w-[140px]">Tiến độ</th>
                  <th className="h-9 px-2 text-center font-medium align-middle w-14">Task</th>
                  <th className="h-9 px-3 text-left font-medium align-middle whitespace-nowrap min-w-[180px]">
                    Thời hạn
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map((project) => {
                  const tasks = project.tasks || [];
                  const projectProgess =
                    tasks.length > 0 ? getProjectProgress(tasks) : project.progress || 0;
                  const href = `/workspaces/${props.workspaceId}/projects/${project.id}`;
                  const start = project?.start_date
                    ? format(new Date(project.start_date), "dd/MM/yyyy")
                    : "—";
                  const end = project?.end_date
                    ? format(new Date(project.end_date), "dd/MM/yyyy")
                    : "—";

                  const isOverdue =
                    project.status !== 'Completed' &&
                    project.end_date &&
                    new Date(project.end_date) < new Date();

                  return (
                    <tr
                      key={project.id}
                      role="link"
                      tabIndex={0}
                      className={cn(
                        "border-b border-border/60 last:border-0 transition-colors",
                        "hover:bg-muted/50 cursor-pointer",
                        isOverdue && "hover:bg-red-50/10"
                      )}
                      onClick={() => navigate(href)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(href);
                        }
                      }}
                    >
                      <td className="p-2 align-middle">
                        <div className="flex items-center gap-2 max-w-[220px] sm:max-w-[280px]">
                          <div className="font-medium text-foreground line-clamp-2">
                            {project.name}
                          </div>
                          {isOverdue && (
                            <span className="bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800 uppercase tracking-wide shrink-0">
                              Trễ hạn
                            </span>
                          )}
                        </div>
                        {project.description ? (
                          <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 max-w-[280px]">
                            {project.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2 align-middle">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                            getTaskStatusColor(project.status)
                          )}
                        >
                          {getProjectStatusLabel(project.status)}
                        </span>
                      </td>
                      <td className="p-2 align-middle">
                        <div className="flex items-center gap-2">
                          <Progress value={projectProgess} className="h-1.5 flex-1 min-w-[56px]" />
                          <span className="text-muted-foreground tabular-nums shrink-0 w-8 text-right">
                            {projectProgess}%
                          </span>
                        </div>
                      </td>
                      <td className="p-2 align-middle text-center tabular-nums">
                        {project?.tasks?.length ?? 0}
                      </td>
                      <td className={cn("p-2 align-middle whitespace-nowrap", isOverdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        <div className="flex items-center gap-1.5">
                          {isOverdue && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          )}
                          <span>{start} → {end}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col items-center gap-4">
              <Pagination>
                <PaginationContent className="gap-2">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) {
                          setCurrentPage(currentPage - 1);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
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
                    // Show first page, last page, current page, and pages around current
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
                              window.scrollTo({ top: 0, behavior: 'smooth' });
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
                          window.scrollTo({ top: 0, behavior: 'smooth' });
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
                Trang {currentPage} / {totalPages} • Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredProjects.length)} trong tổng số {filteredProjects.length} dự án
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
};

export default ProjectList;
