import { BellRing, CheckCircle2, ShieldCheck, Users } from "lucide-react";

const rules = [
  {
    icon: ShieldCheck,
    title: "Kích hoạt sau khi lưu quyền",
    description:
      "Thông báo chỉ được tạo khi cấu hình phân quyền đã lưu thành công trên máy chủ.",
  },
  {
    icon: Users,
    title: "Chỉ gửi đến tài khoản bị ảnh hưởng",
    description:
      "Hệ thống so sánh quyền trước và sau thay đổi; tài khoản không đổi sẽ không nhận thông báo thừa.",
  },
  {
    icon: CheckCircle2,
    title: "Không cần soạn và gửi thủ công",
    description:
      "Người dùng nhận thông báo trong ứng dụng ngay khi tính năng của họ được cấp, điều chỉnh hoặc thu hồi.",
  },
];

export function AutomaticFeatureNotificationPanel() {
  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 shadow-card sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-600 text-white">
          <BellRing className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-violet-600">
          Tự động hóa
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
          Thông báo thay đổi tính năng
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Admin không cần gửi broadcast thủ công. Khi quyền tính năng được thay đổi,
          hệ thống tự động thông báo đến đúng người dùng có quyền thực sự thay đổi.
        </p>
        <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Đang hoạt động
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {rules.map(({ icon: Icon, title, description }) => (
          <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <Icon className="size-5 text-brand-600" aria-hidden="true" />
            <h2 className="mt-4 font-extrabold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
