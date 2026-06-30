import React from "react";
import type { Route } from "../../+types/root";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import i18n from "@/lib/i18n";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MentorHub - Quản lý dự án hiệu quả" },
    {
      name: "description",
      content:
        "Theo dõi tiến độ, quản lý nhóm và tối ưu năng suất làm việc với MentorHub.",
    },
  ];
}

const Homepage = () => {
  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  // Thiết lập ngôn ngữ mặc định ở client để tránh hydration mismatch
  React.useEffect(() => {
    // Luôn hiển thị giao diện tiếng Việt mặc định
    changeLanguage("vi");
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-50 px-4 overflow-x-hidden">
      <main className="max-w-6xl mx-auto w-full py-16 space-y-24">
        {/* Hero */}
        <section className="grid gap-10 md:grid-cols-[1.1fr,0.9fr] items-center">
          {/* Left */}
          <div className="space-y-8">
          <span className="inline-flex items-center rounded-full bg-slate-800/70 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 shadow-sm backdrop-blur">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Sẵn sàng cho đội dự án của bạn
          </span>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight">
              Quản lý dự án hiện đại
              <span className="block text-blue-400">
                Tập trung, trực quan, hiệu quả.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-xl">
              MentorHub giúp bạn theo dõi tiến độ, phân công công việc, và
              phối hợp với đội nhóm trong một không gian làm việc thống nhất,
              trực quan và dễ sử dụng.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Link to="/sign-in">
              <Button
                size="lg"
                className="px-8 bg-blue-600 hover:bg-blue-500 text-slate-50 font-semibold shadow-lg shadow-blue-500/25"
              >
                Đăng nhập ngay
              </Button>
            </Link>

            <p className="text-xs sm:text-sm text-slate-300 max-w-sm">
              Bạn chưa có tài khoản?{" "}
              <span className="font-medium text-blue-300">
                Vui lòng liên hệ quản trị viên (Admin) để được đăng ký.
              </span>
            </p>
          </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20">
              <p className="text-slate-400">Tiến độ theo thời gian thực</p>
              <p className="mt-1 text-base font-semibold text-slate-50">
                Dashboard trực quan
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20">
              <p className="text-slate-400">Cộng tác đa phòng ban</p>
              <p className="mt-1 text-base font-semibold text-slate-50">
                Workspace linh hoạt
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20">
              <p className="text-slate-400">Theo dõi task & hoạt động</p>
              <p className="mt-1 text-base font-semibold text-slate-50">
                Log chi tiết & thông báo
              </p>
            </div>
          </div>
          </div>

          {/* Right */}
          <div className="relative">
          <div className="absolute -inset-4 bg-blue-500/10 blur-3xl rounded-full" />
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl shadow-blue-500/10 overflow-hidden backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              </div>
              <span className="text-xs font-medium text-slate-300">
                Preview workspace
              </span>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Đội dự án
                  </p>
                  <p className="text-sm sm:text-base font-semibold text-slate-50">
                    Marketing Campaign Q2
                  </p>
                </div>
                <span className="rounded-full bg-blue-500/15 text-blue-300 px-2 py-1 text-[10px] font-medium border border-blue-500/40">
                  Đang hoạt động
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-[11px] sm:text-xs">
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3">
                  <p className="text-slate-400">Dự án</p>
                  <p className="mt-2 text-xl font-semibold text-slate-50">
                    12
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-300">
                    +3 trong tuần này
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3">
                  <p className="text-slate-400">Task đang chạy</p>
                  <p className="mt-2 text-xl font-semibold text-slate-50">
                    48
                  </p>
                  <p className="mt-1 text-[10px] text-amber-300">
                    18 sắp đến deadline
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3">
                  <p className="text-slate-400">Hoàn thành</p>
                  <p className="mt-2 text-xl font-semibold text-slate-50">
                    76%
                  </p>
                  <p className="mt-1 text-[10px] text-slate-300">
                    So với tuần trước
                  </p>
                </div>
              </div>

              <div className="mt-1 rounded-lg border border-slate-800 bg-slate-900/80 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-300">
                  Luồng công việc điển hình
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span className="px-2 py-1 rounded-full bg-slate-800/80 text-slate-200 border border-slate-700">
                    Lập kế hoạch sprint
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-800/80 text-slate-200 border border-slate-700">
                    Giao task cho member
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-800/80 text-slate-200 border border-slate-700">
                    Theo dõi tiến độ real-time
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-800/80 text-slate-200 border border-slate-700">
                    Tổng hợp báo cáo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        </section>

        {/* Section: Tính năng nổi bật */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Mọi thứ bạn cần để vận hành dự án hiện đại
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl">
            Từ lập kế hoạch, giao việc, theo dõi tiến độ cho đến báo cáo tổng
            kết – tất cả được gom về một nơi, trực quan và dễ sử dụng.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition-transform duration-300 hover:-translate-y-1 hover:border-blue-500/60 hover:shadow-2xl hover:shadow-blue-500/25">
              <p className="text-xs font-medium text-blue-300 mb-1">
                01 · Planning
              </p>
              <h3 className="text-base font-semibold mb-2">
                Lên roadmap & sprint rõ ràng
              </h3>
              <p className="text-xs text-slate-300">
                Chia nhỏ mục tiêu theo sprint, gắn deadline, ưu tiên task và
                phân bổ tài nguyên hợp lý.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition-transform duration-300 hover:-translate-y-1 hover:border-blue-500/60 hover:shadow-2xl hover:shadow-blue-500/25">
              <p className="text-xs font-medium text-blue-300 mb-1">
                02 · Execution
              </p>
              <h3 className="text-base font-semibold mb-2">
                Quản lý task & thành viên linh hoạt
              </h3>
              <p className="text-xs text-slate-300">
                Giao việc theo role, theo dõi progress từng người, ghi nhận hoạt
                động & bình luận ngay trên task.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition-transform duration-300 hover:-translate-y-1 hover:border-blue-500/60 hover:shadow-2xl hover:shadow-blue-500/25">
              <p className="text-xs font-medium text-blue-300 mb-1">
                03 · Insights
              </p>
              <h3 className="text-base font-semibold mb-2">
                Báo cáo nhanh, quyết định chính xác
              </h3>
              <p className="text-xs text-slate-300">
                Nắm bắt tỷ lệ hoàn thành, tiến độ theo thời gian, dự đoán rủi
                ro để tối ưu kế hoạch sớm.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Quy trình đơn giản */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Quy trình triển khai chỉ với 3 bước
          </h2>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/60 hover:bg-slate-900/70">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold">
                  1
                </span>
                <p className="text-xs font-medium text-slate-300">
                  Tạo workspace & dự án
                </p>
              </div>
              <p className="text-xs text-slate-300">
                Admin tạo workspace, mời thành viên và khởi tạo các dự án theo
                phòng ban hoặc chiến dịch.
              </p>
            </div>
            <div className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/60 hover:bg-slate-900/70">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold">
                  2
                </span>
                <p className="text-xs font-medium text-slate-300">
                  Giao task & theo dõi
                </p>
              </div>
              <p className="text-xs text-slate-300">
                Leader chia nhỏ công việc, gán người phụ trách, đặt ưu tiên và
                deadline rõ ràng.
              </p>
            </div>
            <div className="group rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/60 hover:bg-slate-900/70">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold">
                  3
                </span>
                <p className="text-xs font-medium text-slate-300">
                  Đánh giá & tối ưu
                </p>
              </div>
              <p className="text-xs text-slate-300">
                Cuối mỗi giai đoạn, xem lại tiến độ, rút kinh nghiệm và điều
                chỉnh kế hoạch cho chu kỳ tiếp theo.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Call to action cuối trang */}
        <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-blue-900/40 px-6 py-8 sm:px-10 sm:py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-300">
              Sẵn sàng bắt đầu?
            </p>
            <h2 className="text-2xl font-semibold">
              Đưa đội dự án của bạn lên một tầm cao mới với MentorHub.
            </h2>
            <p className="text-sm text-slate-200">
              Đăng nhập bằng tài khoản đã được quản trị viên cấp và trải nghiệm
              luồng làm việc mượt mà, tập trung.
            </p>
          </div>
          <Link to="/sign-in">
            <Button className="px-8 bg-blue-600 hover:bg-blue-500 text-slate-50 font-semibold shadow-lg shadow-blue-500/30">
              Đăng nhập ngay
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
};

export default Homepage;