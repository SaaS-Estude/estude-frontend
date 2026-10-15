"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Globe2,
  KeyRound,
  LoaderCircle,
  Mail,
  MapPin,
  Save,
  ShieldCheck,
  Smartphone,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-control";
import { useActionNotification } from "@/components/ui/action-notification";
import { ApiError, authenticatedRequest } from "@/lib/auth-api";
import type { DefaultPasswordSettings, ParentLinkSettings } from "@/types/users";

function SettingSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full p-1 transition ${
          checked ? "bg-brand-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}
      >
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-base font-extrabold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export type SystemSettingsSection =
  | "attendance"
  | "notifications"
  | "performance"
  | "ai-question"
  | "default-passwords"
  | "parent-links"
  | "security";

export function SystemSettingsPanel({
  section = "attendance",
}: {
  section?: SystemSettingsSection;
}) {
  const router = useRouter();
  const { notify } = useActionNotification();
  const [attendance, setAttendance] = useState({
    gpsRadius: "100",
    gpsValidity: "30",
    qrValidity: "60",
    gpsEnabled: true,
    qrEnabled: true,
  });
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    inApp: true,
    sender: "no-reply@estude.edu.vn",
    replyTo: "support@estude.edu.vn",
  });
  const [performance, setPerformance] = useState({
    absence: "3",
    lowScore: "5.0",
    atRisk: "6.5",
    aiAnalysis: true,
  });
  const [teacherDefaultPassword, setTeacherDefaultPassword] = useState("");
  const [studentDefaultPassword, setStudentDefaultPassword] = useState("");
  const [parentDefaultPassword, setParentDefaultPassword] = useState("");
  const [passwordSettings, setPasswordSettings] =
    useState<DefaultPasswordSettings | null>(null);
  const [passwordSettingsError, setPasswordSettingsError] = useState("");
  const [loadingPasswordSettings, setLoadingPasswordSettings] = useState(false);
  const [savingPasswordSettings, setSavingPasswordSettings] = useState(false);
  const [parentLinkSettings, setParentLinkSettings] = useState<ParentLinkSettings | null>(null);
  const [parentLinkSettingsError, setParentLinkSettingsError] = useState("");
  const [loadingParentLinkSettings, setLoadingParentLinkSettings] = useState(false);
  const [savingParentLinkSettings, setSavingParentLinkSettings] = useState(false);

  useEffect(() => {
    if (section !== "default-passwords") return;
    let cancelled = false;
    setLoadingPasswordSettings(true);
    setPasswordSettingsError("");
    authenticatedRequest<DefaultPasswordSettings>(
      "/users/default-password-settings",
    )
      .then((settings) => {
        if (!cancelled) setPasswordSettings(settings);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPasswordSettingsError(
            error instanceof ApiError
              ? error.details.join(" · ") || error.message
              : "Không thể tải cấu hình mật khẩu mặc định",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPasswordSettings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  useEffect(() => {
    if (section !== "parent-links") return;
    let cancelled = false;
    setLoadingParentLinkSettings(true);
    setParentLinkSettingsError("");
    authenticatedRequest<ParentLinkSettings>("/users/parent-link-settings")
      .then((settings) => { if (!cancelled) setParentLinkSettings(settings); })
      .catch((error: unknown) => {
        if (!cancelled) setParentLinkSettingsError(error instanceof ApiError ? error.details.join(" · ") || error.message : "Không thể tải cấu hình liên kết phụ huynh");
      })
      .finally(() => { if (!cancelled) setLoadingParentLinkSettings(false); });
    return () => { cancelled = true; };
  }, [section]);

  async function saveParentLinkSettings() {
    if (!parentLinkSettings) return;
    setSavingParentLinkSettings(true);
    setParentLinkSettingsError("");
    try {
      const settings = await authenticatedRequest<ParentLinkSettings>("/users/parent-link-settings", { method: "PATCH", body: JSON.stringify({ requireApproval: parentLinkSettings.requireApproval }) });
      setParentLinkSettings(settings);
      notify("Đã cập nhật quy trình liên kết phụ huynh", { key: "parent-link-settings-saved" });
    } catch (error) {
      setParentLinkSettingsError(error instanceof ApiError ? error.details.join(" · ") || error.message : "Không thể lưu cấu hình liên kết phụ huynh");
    } finally {
      setSavingParentLinkSettings(false);
    }
  }

  async function handleSave() {
    if (section === "default-passwords") {
      if (
        !teacherDefaultPassword &&
        !studentDefaultPassword &&
        !parentDefaultPassword
      ) {
        setPasswordSettingsError(
          "Vui lòng nhập ít nhất một mật khẩu cần cập nhật.",
        );
        return;
      }
      setSavingPasswordSettings(true);
      setPasswordSettingsError("");
      try {
        const settings = await authenticatedRequest<DefaultPasswordSettings>(
          "/users/default-password-settings",
          {
            method: "PATCH",
            body: JSON.stringify({
              ...(teacherDefaultPassword ? { teacherDefaultPassword } : {}),
              ...(studentDefaultPassword ? { studentDefaultPassword } : {}),
              ...(parentDefaultPassword ? { parentDefaultPassword } : {}),
            }),
          },
        );
        setPasswordSettings(settings);
        setTeacherDefaultPassword("");
        setStudentDefaultPassword("");
        setParentDefaultPassword("");
        notify("Đã cập nhật mật khẩu mặc định", {
          key: "default-passwords-saved",
        });
      } catch (error) {
        setPasswordSettingsError(
          error instanceof ApiError
            ? error.details.join(" · ") || error.message
            : "Không thể cập nhật mật khẩu mặc định",
        );
      } finally {
        setSavingPasswordSettings(false);
      }
      return;
    }
    notify("Đã lưu cấu hình hệ thống", { key: "system-settings-saved" });
  }

  return (
    <div className="w-full pb-8">
      {section !== "default-passwords" && section !== "parent-links" ? (
        <div className="mb-3 flex justify-end">
          <Button permission="system_settings.update"
            className="w-fit !rounded-lg"
            onClick={() => void handleSave()}
          >
            <Save className="size-4" />
            Lưu cấu hình
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4">
        <section
          className={`${section === "attendance" ? "" : "hidden"} rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6`}
        >
          <SectionHeader
            icon={MapPin}
            title="Điểm danh GPS/QR"
            description="Kiểm soát phạm vi và thời gian hiệu lực của mỗi lượt điểm danh."
            tone="bg-blue-50 text-brand-600"
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Input
              type="number"
              min="1"
              label="Bán kính GPS"
              value={attendance.gpsRadius}
              onChange={(event) =>
                setAttendance({ ...attendance, gpsRadius: event.target.value })
              }
              hint="Đơn vị: mét"
            />
            <Input
              type="number"
              min="1"
              label="Hiệu lực GPS"
              value={attendance.gpsValidity}
              onChange={(event) =>
                setAttendance({
                  ...attendance,
                  gpsValidity: event.target.value,
                })
              }
              hint="Đơn vị: phút"
            />
            <Input
              type="number"
              min="1"
              label="Hiệu lực mã QR"
              value={attendance.qrValidity}
              onChange={(event) =>
                setAttendance({ ...attendance, qrValidity: event.target.value })
              }
              hint="Thời gian trước khi mã hết hạn"
            />
            <Select label="Cách xác thực ưu tiên" defaultValue="both">
              <option value="both">GPS và QR</option>
              <option value="gps">Chỉ GPS</option>
              <option value="qr">Chỉ QR</option>
            </Select>
          </div>

          <div className="mt-5 grid gap-3">
            <SettingSwitch
              checked={attendance.gpsEnabled}
              onChange={(gpsEnabled) =>
                setAttendance({ ...attendance, gpsEnabled })
              }
              label="Cho phép điểm danh bằng GPS"
              description="Sinh viên cần ở trong bán kính cho phép của lớp học."
            />
            <SettingSwitch
              checked={attendance.qrEnabled}
              onChange={(qrEnabled) =>
                setAttendance({ ...attendance, qrEnabled })
              }
              label="Cho phép điểm danh bằng mã QR"
              description="Mã QR được tạo theo từng buổi học và tự động hết hiệu lực."
            />
          </div>
        </section>

        <section
          className={`${section === "notifications" ? "" : "hidden"} rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6`}
        >
          <SectionHeader
            icon={Bell}
            title="Thông báo hệ thống"
            description="Cấu hình email, thông báo đẩy và các kênh gửi thông báo."
            tone="bg-amber-50 text-amber-600"
          />

          <div className="mt-6 grid gap-3">
            <SettingSwitch
              checked={notifications.email}
              onChange={(email) =>
                setNotifications({ ...notifications, email })
              }
              label="Email"
              description="Gửi thông báo quan trọng đến email của người dùng."
            />
            <SettingSwitch
              checked={notifications.push}
              onChange={(push) => setNotifications({ ...notifications, push })}
              label="Thông báo đẩy"
              description="Hiển thị thông báo tức thời trên trình duyệt hoặc thiết bị."
            />
            <SettingSwitch
              checked={notifications.inApp}
              onChange={(inApp) =>
                setNotifications({ ...notifications, inApp })
              }
              label="Thông báo trong hệ thống"
              description="Lưu thông báo trong trung tâm thông báo của EStude."
            />
          </div>

          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <Input
              label="Email gửi đi"
              value={notifications.sender}
              onChange={(event) =>
                setNotifications({
                  ...notifications,
                  sender: event.target.value,
                })
              }
              icon={Mail}
            />
            <Input
              label="Email nhận phản hồi"
              value={notifications.replyTo}
              onChange={(event) =>
                setNotifications({
                  ...notifications,
                  replyTo: event.target.value,
                })
              }
              icon={Mail}
            />
          </div>
        </section>

        <section
          className={`${section === "performance" ? "" : "hidden"} rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6`}
        >
          <SectionHeader
            icon={BrainCircuit}
            title="Cảnh báo học lực"
            description="Thiết lập ngưỡng để nhận diện và cảnh báo sớm học sinh có nguy cơ."
            tone="bg-violet-50 text-violet-600"
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Input
              type="number"
              min="0"
              label="Vắng tối đa"
              value={performance.absence}
              onChange={(event) =>
                setPerformance({ ...performance, absence: event.target.value })
              }
              hint="Số buổi / học kỳ"
            />
            <Input
              type="number"
              min="0"
              max="10"
              step="0.1"
              label="Điểm thấp"
              value={performance.lowScore}
              onChange={(event) =>
                setPerformance({ ...performance, lowScore: event.target.value })
              }
              hint="Thang điểm 10"
            />
            <Input
              type="number"
              min="0"
              max="10"
              step="0.1"
              label="Có nguy cơ"
              value={performance.atRisk}
              onChange={(event) =>
                setPerformance({ ...performance, atRisk: event.target.value })
              }
              hint="Điểm trung bình"
            />
          </div>

          <div className="mt-5">
            <SettingSwitch
              checked={performance.aiAnalysis}
              onChange={(aiAnalysis) =>
                setPerformance({ ...performance, aiAnalysis })
              }
              label="Bật phân tích học lực bằng AI"
              description="Tự động tổng hợp dữ liệu điểm số và điểm danh để phát hiện sớm rủi ro."
            />
          </div>
        </section>

        <section
          className={`${section === "default-passwords" ? "" : "hidden"} mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6`}
        >
          <SectionHeader
            icon={KeyRound}
            title="Mật khẩu mặc định"
            description="Thiết lập riêng mật khẩu ban đầu cho tài khoản giáo viên, học sinh và phụ huynh được tạo bằng Excel."
            tone="bg-indigo-50 text-indigo-600"
          />

          {loadingPasswordSettings ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" /> Đang tải cấu
              hình...
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Tài khoản giáo viên
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Áp dụng khi import danh sách giáo viên.
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      passwordSettings?.teacherConfigured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {passwordSettings?.teacherConfigured
                      ? "Đã cấu hình"
                      : "Chưa cấu hình"}
                  </span>
                </div>
                <Input
                  icon={KeyRound}
                  type="password"
                  showPasswordToggle
                  label="Mật khẩu mới"
                  minLength={1}
                  maxLength={128}
                  value={teacherDefaultPassword}
                  onChange={(event) =>
                    setTeacherDefaultPassword(event.target.value)
                  }
                  placeholder={
                    passwordSettings?.teacherConfigured
                      ? "Nhập để thay đổi"
                      : "Nhập mật khẩu mặc định"
                  }
                  hint="Không yêu cầu độ mạnh, chỉ cần không để trống."
                  autoComplete="new-password"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Tài khoản học sinh
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Áp dụng khi import danh sách học sinh.
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      passwordSettings?.studentConfigured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {passwordSettings?.studentConfigured
                      ? "Đã cấu hình"
                      : "Chưa cấu hình"}
                  </span>
                </div>
                <Input
                  icon={KeyRound}
                  type="password"
                  showPasswordToggle
                  label="Mật khẩu mới"
                  minLength={1}
                  maxLength={128}
                  value={studentDefaultPassword}
                  onChange={(event) =>
                    setStudentDefaultPassword(event.target.value)
                  }
                  placeholder={
                    passwordSettings?.studentConfigured
                      ? "Nhập để thay đổi"
                      : "Nhập mật khẩu mặc định"
                  }
                  hint="Không yêu cầu độ mạnh, chỉ cần không để trống."
                  autoComplete="new-password"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Tài khoản phụ huynh
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Áp dụng khi import danh sách phụ huynh.
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      passwordSettings?.parentConfigured
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {passwordSettings?.parentConfigured
                      ? "Đã cấu hình"
                      : "Chưa cấu hình"}
                  </span>
                </div>
                <Input
                  icon={KeyRound}
                  type="password"
                  showPasswordToggle
                  label="Mật khẩu mới"
                  minLength={1}
                  maxLength={128}
                  value={parentDefaultPassword}
                  onChange={(event) =>
                    setParentDefaultPassword(event.target.value)
                  }
                  placeholder={
                    passwordSettings?.parentConfigured
                      ? "Nhập để thay đổi"
                      : "Nhập mật khẩu mặc định"
                  }
                  hint="Không yêu cầu độ mạnh, chỉ cần không để trống."
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {passwordSettingsError ? (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {passwordSettingsError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-xs leading-5 text-slate-500">
              Hệ thống không hiển thị lại mật khẩu đã lưu. Bỏ trống ô của vai
              trò không cần thay đổi.
            </p>
            <Button
              className="shrink-0 !rounded-lg"
              disabled={savingPasswordSettings || loadingPasswordSettings}
              permission="password_settings.update"
              onClick={() => void handleSave()}
            >
              {savingPasswordSettings ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {savingPasswordSettings ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </div>
        </section>

        <section className={`${section === "parent-links" ? "" : "hidden"} mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6`}>
          <SectionHeader icon={UsersRound} title="Liên kết phụ huynh – học sinh" description="Thiết lập việc liên kết cần được duyệt trước khi phụ huynh có quyền xem thông tin học sinh." tone="bg-blue-50 text-brand-600" />
          {loadingParentLinkSettings ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Đang tải cấu hình...</p>
          ) : parentLinkSettings ? (
            <div className="mt-6 space-y-4">
              <SettingSwitch checked={parentLinkSettings.requireApproval} onChange={(requireApproval) => setParentLinkSettings({ ...parentLinkSettings, requireApproval })} label="Bắt buộc duyệt liên kết" description="Khi bật, liên kết mới ở trạng thái chờ duyệt và phụ huynh chưa xem được thông tin học sinh." />
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Khi tắt, người có quyền liên kết tạo quan hệ có hiệu lực ngay. Khi bật, người có quyền duyệt sẽ quyết định chấp nhận hoặc từ chối từng liên kết.</p>
            </div>
          ) : null}
          {parentLinkSettingsError ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{parentLinkSettingsError}</p> : null}
          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <Button permission="system_settings.update" disabled={!parentLinkSettings || loadingParentLinkSettings || savingParentLinkSettings} onClick={() => void saveParentLinkSettings()}>
              {savingParentLinkSettings ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              {savingParentLinkSettings ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </div>
        </section>

        <section
          className={`${section === "security" ? "" : "hidden"} rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6`}
        >
          <SectionHeader
            icon={ShieldCheck}
            title="Bảo mật & phiên đăng nhập"
            description="Quản lý các phiên đang hoạt động và kiểm soát truy cập tài khoản."
            tone="bg-emerald-50 text-emerald-600"
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Globe2, label: "Đăng nhập web", value: "03 phiên" },
              {
                icon: Smartphone,
                label: "Thiết bị di động",
                value: "02 thiết bị",
              },
              { icon: Clock3, label: "Phiên gần nhất", value: "2 phút trước" },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <Icon className="size-4 text-slate-400" />
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.push("/admin/settings/sessions")}
            className="mt-5 flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-left text-sm font-bold text-brand-700 transition hover:bg-blue-100"
          >
            <span className="flex items-center gap-2">
              <UsersRound className="size-4" /> Quản lý phiên đăng nhập
            </span>
            <ChevronRight className="size-4" />
          </button>
        </section>
      </div>
    </div>
  );
}
