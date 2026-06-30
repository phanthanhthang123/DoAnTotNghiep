import React from "react";
import { useAuth } from "@/provider/auth-context";
import { Link, Navigate, Outlet, useLocation } from "react-router";

const AuthLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === "/";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-50">
        <div className="animate-pulse text-sm text-slate-300">
          Đang tải phiên đăng nhập...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="dashboard" />;
  }

  // Với trang home, để page tự xử lý layout/scroll dọc hiện đại (chỉ chặn scroll ngang)
  if (isHome) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-50 overflow-x-hidden">
        <Outlet />
      </div>
    );
  }

  // Các trang auth khác: layout trung tâm, body chịu trách nhiệm scroll, nền phủ đủ màn hình
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-50 overflow-x-hidden">
      <div className="relative max-w-5xl mx-auto px-4 py-10 lg:py-16 grid gap-10 lg:grid-cols-[1.1fr,0.9fr] items-start lg:items-center">
        {/* Left intro (consistent với homepage) */}
        <Link to="/">
          <span className="inline-flex items-center rounded-full bg-slate-800/70 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 shadow-sm backdrop-blur">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            MentorHub – không gian làm việc cho cả đội
          </span>
        </Link>
        <div className="hidden lg:block space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">
              Đăng nhập để bắt đầu
              <span className="block text-blue-400">
                Theo dõi tiến độ, phân công công việc, báo cáo nhanh chóng.
              </span>
            </h1>
            <p className="text-sm text-slate-300 max-w-md">
              Quản lý dự án, task, và thành viên trong một giao diện trực quan,
              đồng bộ với dashboard chính của bạn.
            </p>
          </div>
        </div>

        {/* Right: actual auth route content */}
        <div className="relative w-full max-w-md mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;