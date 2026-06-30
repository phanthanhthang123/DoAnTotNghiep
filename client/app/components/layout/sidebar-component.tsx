import { useAuth } from "@/provider/auth-context";
import type { Workspace } from "@/type";
import {
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Wrench,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { t } from "i18next";
import { SidebarNav } from "./sidebar-nav";
import {NAV_ITEMS } from "@/constants/navItems";
import { getChatSocket, useUnreadChatCount } from "@/hooks/use-chat";
import { useQueryClient } from "@tanstack/react-query";
import React from "react";

export const SidebarComponent = ({
  currentWorkspace,
  isOpen = false,
  onClose,
  isMobile = false,
}: {
  currentWorkspace: Workspace | null;
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}) => {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(location.search);
  const workspaceId = searchParams.get("workspaceId") || currentWorkspace?.id || null;
  const chatUnreadCount = useUnreadChatCount(workspaceId);

  React.useEffect(() => {
    const socket = getChatSocket();
    const refreshUnread = () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };
    // Force initial refreshes to avoid unread badge delay after login/reload.
    refreshUnread();
    const t1 = setTimeout(refreshUnread, 400);
    const t2 = setTimeout(refreshUnread, 1500);

    socket.on("connect", refreshUnread);
    socket.on("reconnect", refreshUnread);
    socket.on("message:new", refreshUnread);
    socket.on("message:read:updated", refreshUnread);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      socket.off("connect", refreshUnread);
      socket.off("reconnect", refreshUnread);
      socket.off("message:new", refreshUnread);
      socket.off("message:read:updated", refreshUnread);
    };
  }, [queryClient, workspaceId, user?.id]);

  const handleLogoClick = () => {
    // Lấy workspaceId từ query string hiện tại hoặc từ currentWorkspace
    const searchParams = new URLSearchParams(location.search);
    const workspaceId = searchParams.get('workspaceId') || currentWorkspace?.id;
    
    if (workspaceId) {
      navigate(`/dashboard?workspaceId=${workspaceId}`);
    } else {
      navigate('/dashboard');
    }
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <div
      className={cn(
        isMobile
          ? "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r bg-sidebar transition-transform duration-300 md:hidden"
          : "hidden md:flex flex-col border-r bg-sidebar transition-all duration-300 sticky top-0 h-screen",
        isMobile
          ? (isOpen ? "translate-x-0" : "-translate-x-full")
          : (isCollapsed ? "md:w-[80px]" : "md:w-[240px]")
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-4 mb-4 shrink-0">
        <button 
          onClick={handleLogoClick}
          className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          {isMobile ? (
            <div className="flex items-center gap-2">
              <Wrench className="size-6 text-blue-600" />
              <span className="font-semibold text-lg">
                MentorHub
              </span>
            </div>
          ) : (
            <>
              {!isCollapsed && (
                <div className="flex items-center gap-2">
                  <Wrench className="size-6 text-blue-600" />
                  <span className="font-semibold text-lg hidden md:block">
                    MentorHub
                  </span>
                </div>
              )}
              {isCollapsed && <Wrench className="size-6 text-blue-600" />}
            </>
          )}
        </button>
 
        {isMobile ? (
          onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="size-5" />
            </Button>
          )
        ) : (
          <Button
            variant={"ghost"}
            size = "icon"
            className="ml-auto hidden md:block justify-center"
            onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? (
              <ChevronsRight className="size-4" color="blue" />
            ) : (
              <ChevronsLeft className="size-4" color="blue"/>
            )}
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        {/* Chỉ Admin mới thấy mục Quản Lý Tài Khoản */}
        <SidebarNav
          items={NAV_ITEMS.filter((item) =>
            item.href === "/accounts" ? user?.role === "Admin" : true
          )}
          isCollapsed={isMobile ? false : isCollapsed}
          currentWorkspace={currentWorkspace}
          chatUnreadCount={chatUnreadCount}
          className={cn(!isMobile && isCollapsed && "items-center space-y-2")}
          onItemClick={isMobile ? onClose : undefined}
        />
      </ScrollArea>

      <div className="p-3 border-t">
        <Button
          variant={"ghost"}
          size={(!isMobile && isCollapsed) ? "icon" : "default"}
          className="w-full justify-start"
          onClick={() => {
            logout();
            navigate("/sign-in");
            if (isMobile && onClose) {
              onClose();
            }
          }}
        >
          <LogOut className={cn("size-4", (!isMobile && isCollapsed) ? "" : "mr-2")} />
          {(!isMobile && isCollapsed) ? null : <span>{t("header.signOut")}</span>}
        </Button>
      </div>
    </div>
  );
};
