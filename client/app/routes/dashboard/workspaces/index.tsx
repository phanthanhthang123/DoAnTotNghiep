import { Button } from "@/components/ui/button";
import { CreateWorkspace } from "@/components/workspace/create-workspace";
import { useGetWorkspaceQuery } from "@/hooks/use-workspace";
import type { Workspace } from "@/type";
import { Loader, PlusCircle, Users, Search, MoreVertical, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { NoDataFound } from "@/components/workspace/no-data-found";
import { useAuth } from "@/provider/auth-context";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceAvatar } from "@/components/workspace/workspace-avatar";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Workspaces = () => {
    const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isHiddenCollapsed, setIsHiddenCollapsed] = useState(true);
    const { user } = useAuth();

    const { data: workspaces, isLoading } = useGetWorkspaceQuery(user?.id || "");

    const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
        if (typeof window !== "undefined" && user?.id) {
            const stored = localStorage.getItem(`hidden_workspaces_${user.id}`);
            return stored ? JSON.parse(stored) : [];
        }
        return [];
    });

    const toggleHideWorkspace = (workspaceId: string) => {
        const nextHidden = hiddenIds.includes(workspaceId)
            ? hiddenIds.filter(id => id !== workspaceId)
            : [...hiddenIds, workspaceId];
        setHiddenIds(nextHidden);
        if (user?.id) {
            localStorage.setItem(`hidden_workspaces_${user.id}`, JSON.stringify(nextHidden));
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Filter workspaces by search query
    const filteredWorkspaces = (workspaces || []).filter((ws) =>
        ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ws.description || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group into visible and hidden
    const visibleWorkspaces = filteredWorkspaces.filter((ws) => !hiddenIds.includes(ws.id));
    const hiddenWorkspaces = filteredWorkspaces.filter((ws) => hiddenIds.includes(ws.id));

    const hasWorkspaces = workspaces && workspaces.length > 0;

    return (
        <>
            <div className="space-y-8">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div>
                        <h2 className="text-xl md:text-3xl font-bold">Không Gian Làm Việc</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Quản lý các không gian làm việc và dự án của bạn
                        </p>
                    </div>
                    <Button onClick={() => setIsCreatingWorkspace(true)} className="shrink-0">
                        <PlusCircle className="size-4 mr-2" /> Không Gian Mới
                    </Button>
                </div>

                {/* Filter and Search Bar */}
                {hasWorkspaces && (
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Tìm kiếm không gian..."
                            className="pl-9 h-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                )}

                {/* Main Content Areas */}
                {!hasWorkspaces ? (
                    <NoDataFound
                        title="Không tìm thấy không gian làm việc"
                        description="Tạo một không gian làm việc mới để bắt đầu"
                        buttonText="Tạo Không Gian Làm Việc"
                        buttonAction={() => setIsCreatingWorkspace(true)}
                    />
                ) : filteredWorkspaces.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg border-border/60">
                        <Search className="size-8 text-muted-foreground mb-3 opacity-60" />
                        <h3 className="font-semibold text-base">Không tìm thấy kết quả</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mt-1 px-4">
                            Không tìm thấy không gian làm việc phù hợp với từ khóa "{searchQuery}"
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Visible Workspaces */}
                        {visibleWorkspaces.length > 0 && (
                            <div className="space-y-4">
                                {hiddenWorkspaces.length > 0 && (
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Không gian của bạn ({visibleWorkspaces.length})
                                    </h4>
                                )}
                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {visibleWorkspaces.map((ws) => (
                                        <WorkspaceCard
                                            key={ws.id}
                                            workspace={ws}
                                            isHidden={false}
                                            onToggleHide={() => toggleHideWorkspace(ws.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Hidden Workspaces Section */}
                        {hiddenWorkspaces.length > 0 && (
                            <div className="pt-6 border-t border-border/40 space-y-4">
                                <button
                                    onClick={() => setIsHiddenCollapsed(!isHiddenCollapsed)}
                                    className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group py-1"
                                >
                                    {isHiddenCollapsed ? (
                                        <ChevronRight className="size-4 text-muted-foreground/75 group-hover:text-foreground" />
                                    ) : (
                                        <ChevronDown className="size-4 text-muted-foreground/75 group-hover:text-foreground" />
                                    )}
                                    <span>Không gian ẩn ({hiddenWorkspaces.length})</span>
                                </button>

                                {!isHiddenCollapsed && (
                                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                        {hiddenWorkspaces.map((ws) => (
                                            <WorkspaceCard
                                                key={ws.id}
                                                workspace={ws}
                                                isHidden={true}
                                                onToggleHide={() => toggleHideWorkspace(ws.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <CreateWorkspace
                isCreatingWorkspace={isCreatingWorkspace}
                setIsCreatingWorkspace={setIsCreatingWorkspace}
            />
        </>
    );
};

const WorkspaceCard = ({
    workspace,
    isHidden,
    onToggleHide
}: {
    workspace: Workspace;
    isHidden: boolean;
    onToggleHide: () => void;
}) => {
    return (
        <div className="group relative">
            <Link to={`/workspaces/${workspace.id}`} className="block h-full">
                <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5 border border-border/60 hover:border-border">
                    <CardHeader className="pb-3 flex flex-col justify-between h-full space-y-3">
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex gap-3 items-center min-w-0">
                                    <WorkspaceAvatar
                                        name={workspace?.name}
                                        color={workspace?.color}
                                    />
                                    <div className="min-w-0 space-y-0.5">
                                        <h3 className="font-semibold text-sm leading-tight text-foreground truncate max-w-[150px] sm:max-w-[180px]">
                                            {workspace.name}
                                        </h3>
                                        <span className="text-[10px] text-muted-foreground block">
                                            {workspace?.createdAt ? format(new Date(workspace.createdAt), "dd/MM/yyyy") : "Không xác định"}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Dropdown menu for Hide/Show - prevent propagation so Card Link click isn't triggered */}
                                <div 
                                    className="flex items-center" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                >
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="size-8 rounded-full hover:bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                            >
                                                <MoreVertical className="size-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                            <DropdownMenuItem onClick={onToggleHide} className="cursor-pointer">
                                                {isHidden ? (
                                                    <>
                                                        <Eye className="size-4 mr-2 text-emerald-500" />
                                                        <span>Hiện không gian</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <EyeOff className="size-4 mr-2 text-destructive" />
                                                        <span>Ẩn không gian</span>
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            <CardDescription className="line-clamp-2 text-xs text-muted-foreground/90 mt-1">
                                {workspace.description || "Chưa có mô tả"}
                            </CardDescription>
                        </div>

                        <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-xs text-muted-foreground mt-auto">
                            <span className="text-[11px] font-medium text-primary hover:underline">
                                Xem chi tiết &rarr;
                            </span>
                            <div className="flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-full">
                                <Users className="size-3"/>
                                <span className="text-[11px] font-medium">{workspace?.members?.length || 0}</span>
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </Link>
        </div>
    );
};

export default Workspaces;