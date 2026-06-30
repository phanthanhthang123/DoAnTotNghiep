import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData, updateData, deleteData } from "@/lib/fetch-utlis";
import { useAuth } from "@/provider/auth-context";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Lock, Unlock } from "lucide-react";
import type { User } from "@/type";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

function userInitials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

type UsersResponse = {
  err: number;
  msg: string;
  response: Pick<
    User,
    | "id"
    | "username"
    | "email"
    | "role"
    | "avatarUrl"
    | "isActive"
    | "kpiScore"
    | "kpiModelAtSignup"
    | "cpa"
    | "interviewScore"
    | "cvScore"
    | "yearsAtCompany"
    | "yearsExperience"
    | "numProjectsPrior"
  >[];
};

type EditingUserRow = Pick<
  User,
  | "id"
  | "username"
  | "email"
  | "role"
  | "avatarUrl"
  | "cpa"
  | "interviewScore"
  | "cvScore"
  | "yearsExperience"
  | "numProjectsPrior"
  | "yearsAtCompany"
  | "kpiScore"
  | "kpiModelAtSignup"
>;

type AdminCreateUserResponse = {
  err: number;
  msg: string;
  response?: {
    id: string;
    username: string;
    email: string;
    role: User["role"];
    mustChangePassword?: boolean;
    tempPassword?: string;
    kpiScore?: number | null;
    kpiModelAtSignup?: string | null;
  };
};

type AdminSendUserCredentialsEmailResponse = {
  err: number;
  msg: string;
  response?: any;
};

const ACCOUNTS_PER_PAGE = 6;

const AccountsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [createdTempPassword, setCreatedTempPassword] = React.useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = React.useState<string | null>(null);
  const [createdKpi, setCreatedKpi] = React.useState<{
    score: number | null;
    model: string | null;
  } | null>(null);
  const [editingUser, setEditingUser] = React.useState<null | EditingUserRow>(null);
  // controlled input: cho phép để trống ("") để user xoá số 0 rồi nhập lại
  const [editYearsAtCompanyText, setEditYearsAtCompanyText] = React.useState<string>("0");
  const [internalStats, setInternalStats] = React.useState<null | {
    total_projects: number;
    total_tasks: number;
    hard_tasks: number;
  }>(null);
  const [internalStatsLoading, setInternalStatsLoading] = React.useState(false);

  // Chỉ Admin được vào trang này
  React.useEffect(() => {
    if (user && user.role !== "Admin") {
      navigate("/dashboard");
      toast.error("Bạn không có quyền truy cập trang quản lý tài khoản.");
    }
  }, [user, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const res = await fetchData<UsersResponse>(`/auth/users`, {
        params: search ? { search } : undefined,
      });
      return res.response || [];
    },
  });

  const sendCredentialsEmailMutation = useMutation({
    mutationFn: (payload: { username: string; email: string; tempPassword: string }) =>
      postData<AdminSendUserCredentialsEmailResponse>(
        "/auth/admin/users/send-credentials",
        payload
      ),
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      username: string;
      email: string;
      role: User["role"];
      cpa: number;
      interview_score: number;
      cv_score: number;
      years_experience: number;
      num_projects: number;
      years_at_company: number;
    }) => postData<AdminCreateUserResponse>("/auth/admin/users", payload),
    onSuccess: async (res) => {
      if (res.err === 0) {
        queryClient.invalidateQueries({ queryKey: ["admin-users"], exact: false });
        const temp = res.response?.tempPassword || null;
        const createdEmail = res.response?.email || null;
        const createdUsername = res.response?.username || "";
        setCreatedTempPassword(temp);
        setCreatedEmail(createdEmail);
        setCreatedKpi({
          score: res.response?.kpiScore ?? null,
          model: res.response?.kpiModelAtSignup ?? null,
        });
        setEditingUser(null);
        toast.success("Tạo tài khoản thành công.");

        // Gửi Gmail cho user ngay sau khi tạo xong
        if (temp && createdEmail) {
          try {
            const emailRes = await sendCredentialsEmailMutation.mutateAsync({
              username: createdUsername,
              email: createdEmail,
              tempPassword: temp,
            });
            if (emailRes.err === 0) {
              toast.success("Đã gửi thông tin đăng nhập tới email.");
            } else {
              toast.error(emailRes.msg || "Gửi email thất bại");
            }
          } catch (e: any) {
            toast.error(e?.message || "Gửi email thất bại");
          }
        }
      } else {
        toast.error(res.msg || "Không thể tạo tài khoản");
      }
    },
    onError: (error: unknown) => {
      const ax = error as {
        response?: { data?: { msg?: string; message?: string } };
        message?: string;
      };
      const msg =
        ax?.response?.data?.msg ||
        ax?.response?.data?.message ||
        ax?.message ||
        "Không thể tạo tài khoản";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      username: string;
      email: string;
      role: User["role"];
      cpa: number;
      interview_score: number;
      cv_score: number;
      years_experience: number;
      num_projects: number;
      years_at_company: number;
      total_projects?: number;
      total_tasks?: number;
      hard_tasks?: number;
    }) => updateData(`/auth/admin/users/${payload.id}`, payload),
    onSuccess: (res: any) => {
      if (res.err === 0) {
        queryClient.invalidateQueries({ queryKey: ["admin-users"], exact: false });
        setIsDialogOpen(false);
        setEditingUser(null);
        const k = res.response?.kpiScore;
        const m = res.response?.kpiModelAtSignup;
        if (k != null && m) {
          toast.success(`Đã cập nhật. KPI mới: ${Number(k).toFixed(4)} (${m})`);
        } else {
          toast.success("Cập nhật tài khoản thành công");
        }
      } else {
        toast.error(res.msg || "Không thể cập nhật tài khoản");
      }
    },
    onError: (error: unknown) => {
      const ax = error as {
        response?: { data?: { msg?: string; message?: string } };
        message?: string;
      };
      const msg =
        ax?.response?.data?.msg ||
        ax?.response?.data?.message ||
        ax?.message ||
        "Không thể cập nhật tài khoản";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteData(`/auth/admin/users/${id}`),
    onSuccess: (res: any) => {
      if (res.err === 0) {
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        toast.success("Xóa tài khoản thành công");
      } else {
        toast.error(res.msg || "Không thể xóa tài khoản");
      }
    },
    onError: (error: unknown) => {
      const ax = error as {
        response?: { data?: { msg?: string; message?: string } };
        message?: string;
      };
      const msg =
        ax?.response?.data?.msg ||
        ax?.response?.data?.message ||
        ax?.message ||
        "Không thể xóa tài khoản";
      toast.error(msg);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      updateData<any>(`/auth/admin/users/${payload.id}/toggle-status`, { isActive: payload.isActive }),
    onSuccess: (res: any) => {
      if (res.err === 0) {
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        toast.success(res.msg || "Cập nhật trạng thái tài khoản thành công");
      } else {
        toast.error(res.msg || "Không thể cập nhật trạng thái tài khoản");
      }
    },
    onError: (error: unknown) => {
      const ax = error as {
        response?: { data?: { msg?: string; message?: string } };
        message?: string;
      };
      const msg =
        ax?.response?.data?.msg ||
        ax?.response?.data?.message ||
        ax?.message ||
        "Lỗi khi cập nhật trạng thái";
      toast.error(msg);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const role = (formData.get("role") || "Member") as User["role"];

    if (!username || !email) {
      toast.error("Vui lòng nhập đầy đủ họ tên và email");
      return;
    }

    if (editingUser) {
      const cpa = parseFloat(String(formData.get("cpa") || ""));
      const interview_score = parseFloat(String(formData.get("interview_score") || ""));
      const cv_score = parseFloat(String(formData.get("cv_score") || ""));
      const years_experience = parseFloat(String(formData.get("years_experience") || "0"));
      const num_projects = parseInt(String(formData.get("num_projects") || "0"), 10);
      const years_at_company = Number(editYearsAtCompanyText || 0);
      if (!Number.isFinite(cpa) || cpa < 0 || cpa > 4) {
        toast.error("CPA phải từ 0 đến 4");
        return;
      }
      if (!Number.isFinite(interview_score) || interview_score < 0 || interview_score > 10) {
        toast.error("Điểm phỏng vấn từ 0 đến 10");
        return;
      }
      if (!Number.isFinite(cv_score) || cv_score < 0 || cv_score > 10) {
        toast.error("Điểm CV từ 0 đến 10");
        return;
      }
      if (!Number.isFinite(years_experience) || years_experience < 0 || years_experience > 50) {
        toast.error("Số năm kinh nghiệm không hợp lệ");
        return;
      }
      if (!Number.isFinite(num_projects) || num_projects < 0 || num_projects > 200) {
        toast.error("Số project không hợp lệ");
        return;
      }
      if (!Number.isFinite(years_at_company) || years_at_company < 0 || years_at_company > 50) {
        toast.error("Số năm tại công ty không hợp lệ (0–50)");
        return;
      }
      if (years_at_company >= 1) {
        if (internalStatsLoading) {
          toast.message("Đang lấy thống kê nội bộ, vui lòng chờ...");
          return;
        }
        if (!internalStats) {
          toast.error("Chưa lấy được thống kê nội bộ để tính KPI (model B).");
          return;
        }
      }
      updateMutation.mutate({
        id: editingUser.id,
        username,
        email,
        role,
        cpa,
        interview_score,
        cv_score,
        years_experience,
        num_projects,
        years_at_company,
        ...(years_at_company >= 1 && internalStats
          ? {
              total_projects: internalStats.total_projects,
              total_tasks: internalStats.total_tasks,
              hard_tasks: internalStats.hard_tasks,
            }
          : {}),
      });
    } else {
      const cpa = parseFloat(String(formData.get("cpa") || ""));
      const interview_score = parseFloat(String(formData.get("interview_score") || ""));
      const cv_score = parseFloat(String(formData.get("cv_score") || ""));
      const years_experience = parseFloat(String(formData.get("years_experience") || "0"));
      const num_projects = parseInt(String(formData.get("num_projects") || "0"), 10);
      const years_at_company = parseFloat(String(formData.get("years_at_company") || "0"));
      if (!Number.isFinite(cpa) || cpa < 0 || cpa > 4) {
        toast.error("CPA phải từ 0 đến 4");
        return;
      }
      if (!Number.isFinite(interview_score) || interview_score < 0 || interview_score > 10) {
        toast.error("Điểm phỏng vấn từ 0 đến 10");
        return;
      }
      if (!Number.isFinite(cv_score) || cv_score < 0 || cv_score > 10) {
        toast.error("Điểm CV từ 0 đến 10");
        return;
      }
      if (!Number.isFinite(years_experience) || years_experience < 0 || years_experience > 50) {
        toast.error("Số năm kinh nghiệm không hợp lệ");
        return;
      }
      if (!Number.isFinite(num_projects) || num_projects < 0 || num_projects > 200) {
        toast.error("Số project không hợp lệ");
        return;
      }
      if (!Number.isFinite(years_at_company) || years_at_company < 0 || years_at_company > 50) {
        toast.error("Số năm tại công ty không hợp lệ (0–50)");
        return;
      }
      setCreatedTempPassword(null);
      setCreatedEmail(null);
      setCreatedKpi(null);
      createMutation.mutate({
        username,
        email,
        role,
        cpa,
        interview_score,
        cv_score,
        years_experience,
        num_projects,
        years_at_company,
      });
    }
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setCreatedTempPassword(null);
    setCreatedEmail(null);
    setCreatedKpi(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (u: EditingUserRow) => {
    setEditingUser(u);
    setCreatedTempPassword(null);
    setCreatedEmail(null);
    setCreatedKpi(null);
    setIsDialogOpen(true);
  };

  React.useEffect(() => {
    if (!editingUser) {
      setEditYearsAtCompanyText("0");
      setInternalStats(null);
      setInternalStatsLoading(false);
      return;
    }
    setEditYearsAtCompanyText(String(Number(editingUser.yearsAtCompany ?? 0)));
    setInternalStats(null);
    setInternalStatsLoading(false);
  }, [editingUser?.id]);

  const loadInternalStats = React.useCallback(async () => {
    if (!editingUser?.id) return null;
    setInternalStatsLoading(true);
    try {
      const res = await fetchData<{
        err: number;
        msg: string;
        response?: { total_projects: number; total_tasks: number; hard_tasks: number } | null;
      }>(`/auth/admin/users/${editingUser.id}/internal-stats`);
      if (res.err !== 0 || !res.response) {
        toast.error(res.msg || "Không lấy được thống kê nội bộ");
        setInternalStats(null);
        return null;
      }
      const next = {
        total_projects: Number(res.response.total_projects ?? 0),
        total_tasks: Number(res.response.total_tasks ?? 0),
        hard_tasks: Number(res.response.hard_tasks ?? 0),
      };
      setInternalStats(next);
      return next;
    } catch (e: any) {
      toast.error(e?.response?.data?.msg || "Không lấy được thống kê nội bộ");
      setInternalStats(null);
      return null;
    } finally {
      setInternalStatsLoading(false);
    }
  }, [editingUser?.id]);

  React.useEffect(() => {
    if (!editingUser) return;
    const yac = Number(editYearsAtCompanyText || 0);
    if (yac >= 1 && !internalStats && !internalStatsLoading) {
      loadInternalStats();
    }
  }, [editYearsAtCompanyText, editingUser?.id]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Pagination computation
  const allAccounts = data || [];
  const totalPages = Math.max(1, Math.ceil(allAccounts.length / ACCOUNTS_PER_PAGE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * ACCOUNTS_PER_PAGE;
  const endIndex = startIndex + ACCOUNTS_PER_PAGE;
  const paginatedData = allAccounts.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Card sáng, dễ đọc hơn, đồng bộ với nền trắng của dashboard */}
      <Card className="bg-white text-slate-900 border-slate-200 shadow-md ">
        <CardHeader className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl md:text-2xl">
              Quản lý tài khoản
            </CardTitle>
            <CardDescription>
              Tạo, chỉnh sửa và xóa tài khoản người dùng trong hệ thống.
            </CardDescription>
          </div>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setCreatedKpi(null);
                setCreatedTempPassword(null);
                setCreatedEmail(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-blue-600 hover:bg-blue-500 text-white"
                onClick={openCreateDialog}
              >
                <Plus className="w-4 h-4 mr-2" />
                Thêm tài khoản
              </Button>
            </DialogTrigger>
            <DialogContent
              className="w-[96vw] max-w-4xl max-h-[95vh] overflow-y-auto"
              onOpenAutoFocus={(e) => {
                // Tránh Radix auto-focus vào input đầu tiên (Họ tên)
                e.preventDefault();
              }}
            >
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Chỉnh sửa tài khoản" : "Thêm tài khoản mới"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser
                    ? "Cập nhật thông tin, vai trò và chỉ số KPI. Khi đổi CPA / phỏng vấn / CV / kinh nghiệm / project, KPI onboarding được tính lại (Python)."
                    : "Hệ thống sẽ tạo mật khẩu ngẫu nhiên cho tài khoản mới."}
                </DialogDescription>
              </DialogHeader>
              {/* After create: show random password clearly */}
              {!editingUser && createdTempPassword ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      Tài khoản đã được tạo
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Hãy gửi thông tin này cho người dùng. Khi đăng nhập lần đầu,
                      hệ thống sẽ yêu cầu đổi mật khẩu.
                    </p>
                    <div className="mt-3 space-y-3">
                      {createdKpi && (createdKpi.score != null || createdKpi.model) && (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                          <p className="font-semibold">KPI khởi tạo (Logistic Regression)</p>
                          <p className="mt-1">
                            Điểm:{" "}
                            <span className="font-mono font-medium">
                              {createdKpi.score != null ? createdKpi.score.toFixed(4) : "—"}
                            </span>
                                {createdKpi.model ? (
                              <span className="ml-2 text-emerald-800">
                                (Model {createdKpi.model}
                                {createdKpi.model === "A" ? " — onboarding" : ""}
                                )
                              </span>
                            ) : null}
                          </p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={createdEmail || ""}
                            className="bg-white"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              await navigator.clipboard.writeText(createdEmail || "");
                              toast.success("Đã copy email");
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Mật khẩu random</Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={createdTempPassword}
                            className="bg-white"
                          />
                          <Button
                            type="button"
                            className="bg-blue-600 hover:bg-blue-500 text-white"
                            onClick={async () => {
                              await navigator.clipboard.writeText(createdTempPassword);
                              toast.success("Đã copy mật khẩu");
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setCreatedTempPassword(null);
                        setCreatedEmail(null);
                        setCreatedKpi(null);
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      Đóng
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={handleSubmit}
                  key={editingUser?.id ?? "create"}
                >
                  <div className="space-y-2">
                    <Label htmlFor="username">Họ tên</Label>
                    <Input
                      id="username"
                      name="username"
                      defaultValue={editingUser?.username || ""}
                      placeholder="Nhập họ tên"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={editingUser?.email || ""}
                      placeholder="Nhập email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Vai trò</Label>
                    <select
                      id="role"
                      name="role"
                      defaultValue={editingUser?.role || "Member"}
                      className="flex h-9 w-full min-w-[160px] rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Leader">Leader</option>
                      <option value="Member">Member</option>
                    </select>
                  </div>
                  <>
                    <p className="text-xs font-medium text-slate-600 pt-1">
                      {editingUser
                        ? "Hồ sơ KPI & công ty (lưu ý: đổi CPA/CV/phỏng vấn/KN → KPI được tính lại)"
                        : "Chỉ số KPI (Python — model onboarding A)"}
                    </p>
                    {editingUser &&
                      (editingUser.kpiScore != null || editingUser.kpiModelAtSignup) && (
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          <span className="font-medium">KPI hiện tại:</span>{" "}
                          <span className="font-mono">
                            {editingUser.kpiScore != null
                              ? Number(editingUser.kpiScore).toFixed(4)
                              : "—"}
                          </span>
                          {editingUser.kpiModelAtSignup ? (
                            <span className="text-slate-500 ml-1">
                              (model {editingUser.kpiModelAtSignup})
                            </span>
                          ) : null}
                        </div>
                      )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="cpa">CPA (0–4)</Label>
                        <Input
                          id="cpa"
                          name="cpa"
                          type="number"
                          step="0.01"
                          min={0}
                          max={4}
                          defaultValue={
                            editingUser?.cpa != null ? Number(editingUser.cpa) : 3
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="interview_score">Điểm phỏng vấn (0–10)</Label>
                        <Input
                          id="interview_score"
                          name="interview_score"
                          type="number"
                          step="0.1"
                          min={0}
                          max={10}
                          defaultValue={
                            editingUser?.interviewScore != null
                              ? Number(editingUser.interviewScore)
                              : 6
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="cv_score">Điểm CV (0–10)</Label>
                        <Input
                          id="cv_score"
                          name="cv_score"
                          type="number"
                          step="0.1"
                          min={0}
                          max={10}
                          defaultValue={
                            editingUser?.cvScore != null ? Number(editingUser.cvScore) : 6
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="years_experience">Năm kinh nghiệm(trước công ty)</Label>
                        <Input
                          id="years_experience"
                          name="years_experience"
                          type="number"
                          step="0.5"
                          min={0}
                          max={50}
                          defaultValue={
                            editingUser?.yearsExperience != null
                              ? Number(editingUser.yearsExperience)
                              : 0
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="years_at_company">Năm làm việc tại công ty</Label>
                        <Input
                          id="years_at_company"
                          name="years_at_company"
                          type="number"
                          step="0.5"
                          min={0}
                          max={50}
                          value={editYearsAtCompanyText}
                          onChange={(e) => {
                            const nextText = e.target.value;
                            setEditYearsAtCompanyText(nextText);
                            const yac = Number(nextText || 0);
                            if (!Number.isFinite(yac) || yac < 1) {
                              // chuyển về onboarding → ẩn và clear stats nội bộ
                              setInternalStats(null);
                            }
                          }}
                        />
                      </div>
                      {Number(editYearsAtCompanyText || 0) >= 1 && (
                        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-slate-700">
                              KPI nội bộ (model B) — tự lấy theo task bạn tham gia
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 px-3 text-xs"
                              disabled={internalStatsLoading}
                              onClick={loadInternalStats}
                            >
                              {internalStatsLoading ? "Đang tải..." : "Làm mới"}
                            </Button>
                          </div>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor="internal_total_projects">
                                Tổng project nội bộ
                              </Label>
                              <Input
                                id="internal_total_projects"
                                value={internalStats?.total_projects ?? 0}
                                readOnly
                                className="bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor="internal_total_tasks">
                                Tổng task nội bộ
                              </Label>
                              <Input
                                id="internal_total_tasks"
                                value={internalStats?.total_tasks ?? 0}
                                readOnly
                                className="bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor="internal_hard_tasks">
                                Task khó nội bộ
                              </Label>
                              <Input
                                id="internal_hard_tasks"
                                value={internalStats?.hard_tasks ?? 0}
                                readOnly
                                className="bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="num_projects">Số project đã làm (trước đây)</Label>
                        <Input
                          id="num_projects"
                          name="num_projects"
                          type="number"
                          min={0}
                          max={200}
                          defaultValue={
                            editingUser?.numProjectsPrior != null
                              ? Number(editingUser.numProjectsPrior)
                              : 0
                          }
                        />
                      </div>
                    </div>
                  </>
                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setEditingUser(null);
                        setCreatedTempPassword(null);
                        setCreatedEmail(null);
                        setCreatedKpi(null);
                      }}
                    >
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                      disabled={isSaving}
                    >
                      {isSaving
                        ? "Đang lưu..."
                        : editingUser
                        ? "Cập nhật"
                        : "Tạo tài khoản"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Input
              className="w-full sm:max-w-xs bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
              placeholder="Tìm theo tên hoặc email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Chỉ tài khoản Admin mới có quyền quản lý người dùng.
            </p>
          </div>

          {/* Mobile View: Accounts Cards */}
          <div className="block md:hidden space-y-4">
            {isLoading && (
              <div className="text-center py-6 text-slate-500 bg-white border border-slate-200 rounded-lg">
                Đang tải danh sách tài khoản...
              </div>
            )}
            {!isLoading && (!data || data.length === 0) && (
              <div className="text-center py-6 text-slate-500 bg-white border border-slate-200 rounded-lg">
                Chưa có tài khoản nào.
              </div>
            )}
            {!isLoading &&
              data &&
              paginatedData.map((u) => (
                <div
                  key={u.id}
                  className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:border-blue-500 transition-colors space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10 shrink-0">
                      <AvatarImage src={u.avatarUrl || undefined} alt={u.username} />
                      <AvatarFallback className="text-xs font-semibold">
                        {userInitials(u.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-800 truncate">{u.username}</h3>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center justify-between text-xs pt-2 border-t">
                    <div className="flex gap-1.5 items-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                        {u.role}
                      </span>
                      {u.isActive !== false ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                          Bị khóa
                        </span>
                      )}
                    </div>
                    {u.kpiScore != null && u.kpiScore !== undefined ? (
                      <div className="font-mono text-slate-700">
                        KPI: {Number(u.kpiScore).toFixed(3)}
                        {u.kpiModelAtSignup ? (
                          <span className="text-slate-400 ml-1">({u.kpiModelAtSignup})</span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-slate-400">KPI: —</div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex items-center gap-1"
                      onClick={() =>
                        openEditDialog({
                          id: u.id,
                          username: u.username,
                          email: u.email,
                          role: u.role,
                          avatarUrl: u.avatarUrl,
                          cpa: u.cpa ?? null,
                          interviewScore: u.interviewScore ?? null,
                          cvScore: u.cvScore ?? null,
                          yearsExperience: u.yearsExperience ?? 0,
                          numProjectsPrior: u.numProjectsPrior ?? 0,
                          yearsAtCompany: u.yearsAtCompany ?? 0,
                          kpiScore: u.kpiScore ?? null,
                          kpiModelAtSignup: u.kpiModelAtSignup ?? null,
                        })
                      }
                    >
                      <Pencil className="w-3.5 h-3.5" /> Sửa
                    </Button>
                    {user?.id !== u.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs flex items-center gap-1 border-slate-200"
                        title={u.isActive !== false ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                        onClick={() => {
                          const nextState = u.isActive === false;
                          if (
                            window.confirm(
                              `Bạn có chắc chắn muốn ${nextState ? "mở khóa" : "khóa"} tài khoản ${u.email}?`
                            )
                          ) {
                            toggleStatusMutation.mutate({ id: u.id, isActive: nextState });
                          }
                        }}
                      >
                        {u.isActive !== false ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-red-500">Khóa</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Mở</span>
                          </>
                        )}
                      </Button>
                    )}
                    {user?.id !== u.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs flex items-center gap-1 border-red-500/60 text-red-500 hover:bg-red-50"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Bạn có chắc chắn muốn xóa tài khoản ${u.email}?`
                            )
                          ) {
                            deleteMutation.mutate(u.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" /> Xóa
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Desktop View: Accounts Table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-700 w-14">
                    Ảnh
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Họ tên
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Vai trò
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    Trạng thái
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-700">
                    KPI
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-slate-700">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      Đang tải danh sách tài khoản...
                    </td>
                  </tr>
                )}
                {!isLoading && (!data || data.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      Chưa có tài khoản nào.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  data &&
                  paginatedData.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-slate-100 hover:bg-blue-50"
                    >
                      <td className="px-4 py-2">
                        <Avatar className="size-9">
                          <AvatarImage src={u.avatarUrl || undefined} alt={u.username} />
                          <AvatarFallback className="text-xs font-semibold">
                            {userInitials(u.username)}
                          </AvatarFallback>
                        </Avatar>
                      </td>
                      <td className="px-4 py-2 text-slate-800">{u.username}</td>
                      <td className="px-4 py-2 text-slate-800">{u.email}</td>
                      <td className="px-4 py-2 text-slate-800">{u.role}</td>
                      <td className="px-4 py-2 text-slate-800">
                        {u.isActive !== false ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                            Bị khóa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-700 text-xs">
                        {u.kpiScore != null && u.kpiScore !== undefined ? (
                          <span className="font-mono">
                            {Number(u.kpiScore).toFixed(3)}
                            {u.kpiModelAtSignup ? (
                              <span className="text-slate-500 ml-1">({u.kpiModelAtSignup})</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              openEditDialog({
                                id: u.id,
                                username: u.username,
                                email: u.email,
                                role: u.role,
                                avatarUrl: u.avatarUrl,
                                cpa: u.cpa ?? null,
                                interviewScore: u.interviewScore ?? null,
                                cvScore: u.cvScore ?? null,
                                yearsExperience: u.yearsExperience ?? 0,
                                numProjectsPrior: u.numProjectsPrior ?? 0,
                                yearsAtCompany: u.yearsAtCompany ?? 0,
                                kpiScore: u.kpiScore ?? null,
                                kpiModelAtSignup: u.kpiModelAtSignup ?? null,
                              })
                            }
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {user?.id !== u.id && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 border-slate-200"
                              title={u.isActive !== false ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                              onClick={() => {
                                const nextState = u.isActive === false;
                                if (
                                  window.confirm(
                                    `Bạn có chắc chắn muốn ${nextState ? "mở khóa" : "khóa"} tài khoản ${u.email}?`
                                  )
                                ) {
                                  toggleStatusMutation.mutate({ id: u.id, isActive: nextState });
                                }
                              }}
                            >
                              {u.isActive !== false ? (
                                <Lock className="w-3 h-3 text-red-500" />
                              ) : (
                                <Unlock className="w-3 h-3 text-emerald-500" />
                              )}
                            </Button>
                          )}
                          {user?.id !== u.id && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 border-red-500/60 text-red-400 hover:bg-red-500/10"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Bạn có chắc chắn muốn xóa tài khoản ${u.email}?`
                                  )
                                ) {
                                  deleteMutation.mutate(u.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && data && data.length > ACCOUNTS_PER_PAGE && (
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
                  Trang {safePage} / {totalPages} • Hiển thị {startIndex + 1}-{Math.min(endIndex, data.length)} trong tổng số{" "}
                  {data.length} tài khoản
                </div>
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountsPage;


