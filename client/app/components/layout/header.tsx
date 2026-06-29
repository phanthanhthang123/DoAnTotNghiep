import { useAuth } from "@/provider/auth-context";
import type { Workspace } from "@/type";
import type { AppNotification } from "@/type";
import { Button } from "../ui/button";
import { useLoaderData, useLocation, useNavigate } from "react-router";
import { Bell, LogOut, PlusCircle, Settings, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { WorkspaceAvatar } from "../workspace/workspace-avatar";
import { DropdownMenuGroup } from "@radix-ui/react-dropdown-menu";
import { Badge } from "../ui/badge";
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useMyNotificationsQuery,
} from "@/hooks/use-notification";

interface HeaderProps {
  onWorkspaceSelected?: (workspace: Workspace) => void;
  selectedWorkspace?: Workspace | null;
  onCreateWorkspace?: () => void;
  onMenuToggle?: () => void;
}

export const Header = ({
  onWorkspaceSelected,
  selectedWorkspace,
  onCreateWorkspace,
  onMenuToggle,
}: HeaderProps) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { data: notificationData } = useMyNotificationsQuery(12);
  const { mutate: markAsRead } = useMarkNotificationReadMutation();
  const { mutate: markAllAsRead } = useMarkAllNotificationsReadMutation();

  const getLastNameInitial = (username: string) => {
    if (!username || username.trim() === "") return "";
    const names = username.trim().split(" ").filter(name => name.length > 0);
    if (names.length === 0) return "";
    const lastName = names[names.length - 1];
    return lastName.charAt(0).toUpperCase();
  };
  const loaderData = useLoaderData() as { workspaces?: Workspace[] };
  const workspaces = loaderData?.workspaces || [];
  // console.log(workspaces)

  const isOnWorkspacePage = useLocation().pathname.includes('/workspaces');
  const navigate = useNavigate();

  // Check if user has permission to create workspace (Admin or Leader)
  const canCreateWorkspace = user?.role === 'Admin' || user?.role === 'Leader';

  const handleOnClickWorkspace = (ws: Workspace) => {
    onWorkspaceSelected && onWorkspaceSelected(ws);
    if (isOnWorkspacePage) {
      navigate(`/workspaces/${ws.id}`);
    } else {
      const basePath = location.pathname;
      navigate(`${basePath}?workspaceId=${ws.id}`);
    }
  }

  const getNotificationAgoText = (createdAt: string | Date) => {
    const time = new Date(createdAt).getTime();
    const diffMs = Date.now() - time;
    const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  };

  const notifications = notificationData?.response || [];
  const unreadCount = notificationData?.unreadCount || 0;

  const handleOpenNotification = (notification: AppNotification) => {
    if (notification.is_read !== "TRUE") {
      markAsRead(notification.id);
    }
    const payload = notification.payload as any;
    if (payload?.type === "task" && payload?.taskId && payload?.projectId) {
      const workspaceIdFromPayload = payload?.workspaceId || localStorage.getItem("selectedWorkspaceId");
      if (workspaceIdFromPayload) {
        navigate(`/workspaces/${workspaceIdFromPayload}/projects/${payload.projectId}/tasks/${payload.taskId}`);
        return;
      }
    }
    // Default: send to chat.
    navigate("/chat");
  };

  return (
    <div className="bg-background sticky top-0 z-40 border-b">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center gap-2">
          {onMenuToggle && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onMenuToggle}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={"outline"}>
                {selectedWorkspace ? (
                  <>
                    {selectedWorkspace.color && (
                      <WorkspaceAvatar
                        color={selectedWorkspace.color}
                        name={selectedWorkspace.name}
                      />
                    )}
                    <span className="font-medium">{selectedWorkspace?.name}</span>
                  </>
                ) : (
                  <span className="font-medium">
                    {t("header.selectWorkspace")}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
              <DropdownMenuLabel>{t("header.workspaces")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {workspaces?.map((ws: any) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => handleOnClickWorkspace(ws)}
                  >
                    {ws.color && (
                      <WorkspaceAvatar color={ws.color} name={ws.name} />
                    )}
                    <span className="ml-2">{ws.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>

              {canCreateWorkspace && (
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={onCreateWorkspace}>
                    <PlusCircle className="w-4 h-4 mr-2" /> {t("header.createWorkspace")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              )}

            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] max-h-[420px] overflow-y-auto">
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="p-0">Thông báo</DropdownMenuLabel>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => markAllAsRead()}
                  disabled={unreadCount === 0}
                >
                  Đánh dấu tất cả đã đọc
                </Button>
              </div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">Chưa có thông báo nào</div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="cursor-pointer py-2.5 px-3 flex flex-col items-start gap-1"
                    onClick={() => handleOpenNotification(notification)}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <p
                        className={`text-xs leading-5 ${
                          notification.is_read === "TRUE" ? "text-muted-foreground" : "font-medium"
                        }`}
                      >
                        {notification.message}
                      </p>
                      {notification.is_read !== "TRUE" && (
                        <span className="mt-1 size-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {getNotificationAgoText(notification.createdAt)}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full border p-1 w-8 h-8">
                <Avatar className="w-8 h-8">
                  <AvatarImage
                    src={user?.avatarUrl || undefined}
                    alt={user?.username || "User"}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getLastNameInitial(user?.username || "") || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("header.myAccount")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link to="/settings" className="flex items-center w-full cursor-pointer">
                <DropdownMenuItem className="flex items-center w-full cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" /> {t("header.profile")}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => {
                logout();
                navigate("/sign-in");
              }}>
                <LogOut className="w-4 h-4 mr-2" /> {t("header.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
