import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/provider/auth-context";
import { Loader } from "@/components/loader";
import { Outlet, useNavigate, useLocation, useLoaderData, useRevalidator } from "react-router";
import type { Workspace } from "@/type";
import { SidebarComponent } from "@/components/layout/sidebar-component";
import { CreateWorkspace } from "@/components/workspace/create-workspace";
import { postData } from "@/lib/fetch-utlis";
import { getChatSocket } from "@/hooks/use-chat";

export const clientLoader = async () => {
  try {
    const userInfo = JSON.parse(localStorage.getItem("user") || "{}");
    if (!userInfo || !userInfo.id) {
      return { workspaces: [] };
    }
    const workspaces = await postData<Workspace[]>("/workspace/list-workspace-by-user", {user_id: userInfo.id});
    return { workspaces: workspaces || [] };
  } catch (error) {
    console.error("Error loading workspaces:", error);
    return { workspaces: [] };
  }
}

const DashBoardLayout = () => {
  const {isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const revalidator = useRevalidator();
  const { workspaces } = useLoaderData() as { workspaces: Workspace[] };
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  // Refetch workspaces when user changes (after login)
  useEffect(() => {
    if (user && isAuthenticated && !isLoading) {
      // Check if workspaces need to be refetched
      // This will trigger when user logs in and navigates to dashboard
      const userInfo = JSON.parse(localStorage.getItem("user") || "{}");
      if (userInfo?.id && userInfo.id === user.id) {
        // Small delay to ensure everything is ready
        const timer = setTimeout(() => {
          revalidator.revalidate();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.id, isAuthenticated, isLoading, revalidator]);

  // Load saved workspace from localStorage on mount and sync
  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      const savedWorkspaceId = localStorage.getItem('selectedWorkspaceId');
      const workspace = workspaces.find((ws: Workspace) => ws.id === savedWorkspaceId);
      if (workspace) {
        setCurrentWorkspace(workspace);
      } else {
        // Fallback to first workspace if saved one is not found or is invalid for this user
        setCurrentWorkspace(workspaces[0]);
        localStorage.setItem('selectedWorkspaceId', workspaces[0].id);
      }
    } else {
      setCurrentWorkspace(null);
      localStorage.removeItem('selectedWorkspaceId');
    }
  }, [workspaces]);

  // Sync currentWorkspace with URL params when on workspace page
  useEffect(() => {
    const pathMatch = location.pathname.match(/\/workspaces\/([^/]+)/);
    if (pathMatch && workspaces) {
      const workspaceId = pathMatch[1];
      const workspace = workspaces.find((ws: Workspace) => ws.id === workspaceId);
      if (workspace) {
        setCurrentWorkspace(workspace);
        // Save to localStorage
        localStorage.setItem('selectedWorkspaceId', workspaceId);
      }
    }
    // Don't clear currentWorkspace when navigating away from workspace page
    // Keep the selected workspace visible in header
  }, [location.pathname, workspaces]);

  // Keep chat presence online across all dashboard pages
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const socket = getChatSocket();

    let lastEmit = 0;
    const emitHeartbeat = () => {
      const now = Date.now();
      if (now - lastEmit < 5000) return;
      lastEmit = now;
      socket.emit("presence:heartbeat");
    };

    emitHeartbeat();
    const interval = setInterval(emitHeartbeat, 30000);
    window.addEventListener("mousemove", emitHeartbeat);
    window.addEventListener("keydown", emitHeartbeat);
    window.addEventListener("click", emitHeartbeat);
    window.addEventListener("focus", emitHeartbeat);

    return () => {
      clearInterval(interval);
      window.removeEventListener("mousemove", emitHeartbeat);
      window.removeEventListener("keydown", emitHeartbeat);
      window.removeEventListener("click", emitHeartbeat);
      window.removeEventListener("focus", emitHeartbeat);
    };
  }, [isAuthenticated, user?.id]);

  if(isLoading) {
    return <Loader/>
  }
  if(!isAuthenticated) {
    return navigate("/sign-in");
  }

  // Bắt buộc đổi mật khẩu lần đầu nếu server đánh dấu mustChangePassword = true
  if (user?.mustChangePassword && location.pathname !== "/first-change-password") {
    return navigate("/first-change-password");
  }

  const handleWorkspaceSelected = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    // Save to localStorage to persist across page refreshes
    localStorage.setItem('selectedWorkspaceId', workspace.id);
    // Navigate to workspace details page
    navigate(`/workspaces/${workspace.id}`);
  }
  const handleCreateWorkspace = () => {
    setIsCreatingWorkspace(true);
  }

  const isFixedViewportRoute =
    location.pathname === "/chat" ||
    location.pathname === "/settings" ||
    location.pathname === "/my-tasks";

  return (
    <div className="flex h-screen w-full overflow-hidden relative">
      {/* Desktop Sidebar Component */}
      <SidebarComponent currentWorkspace={currentWorkspace} />
      
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Component */}
      <SidebarComponent 
        currentWorkspace={currentWorkspace}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        isMobile
      />

      <div className="flex flex-1 flex-col h-full min-w-0">
        {/* Header */}
        <Header
          onWorkspaceSelected = {(workspace) => handleWorkspaceSelected(workspace)}
          selectedWorkspace = {currentWorkspace}
          onCreateWorkspace = {() => setIsCreatingWorkspace(true)}
          onMenuToggle = {() => setIsMobileSidebarOpen(true)}
        />
        {/* Chỉ content được scroll; sidebar cố định */}
        <main
          className={`flex-1 w-full ${
            isFixedViewportRoute ? "overflow-hidden p-0" : "overflow-y-auto p-4"
          }`}
        >
          <div
            className={`mx-auto container w-full min-w-0 ${
              isFixedViewportRoute ? "h-full px-2 sm:px-4 lg:px-6 py-2" : "px-2 sm:px-6 lg:px-8 py-0 md:py-8"
            }`}
          >
            <Outlet />
          </div>
        </main>
      </div>
      <CreateWorkspace 
        isCreatingWorkspace = {isCreatingWorkspace}
        setIsCreatingWorkspace = {setIsCreatingWorkspace}
      />
    </div>
  );
};

export default DashBoardLayout;
