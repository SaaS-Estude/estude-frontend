import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  School,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const features = [
  {
    icon: BookOpen,
    title: "Lớp học & học liệu",
    description:
      "Tổ chức lớp và môn học, chia sẻ tài liệu, tìm lại nội dung cần học trong cùng một không gian.",
    tone: "bg-blue-50 text-brand-700",
  },
  {
    icon: ClipboardCheck,
    title: "Kiểm tra & đánh giá",
    description:
      "Quản lý ngân hàng câu hỏi, tạo bài thi, theo dõi bài làm và xem phân tích kết quả sau mỗi lần đánh giá.",
    tone: "bg-violet-50 text-violet-700",
  },
  {
    icon: Sparkles,
    title: "Hỗ trợ học tập với AI",
    description:
      "Ôn tập từ học liệu với flashcard, câu hỏi luyện tập và bản đồ kiến thức; hỗ trợ giáo viên tạo câu hỏi.",
    tone: "bg-cyan-50 text-cyan-700",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Tiến độ & kế hoạch học tập",
    description:
      "Theo dõi kết quả, nhận diện nội dung cần củng cố và thực hiện kế hoạch học tập do giáo viên giao.",
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    icon: MessagesSquare,
    title: "Kết nối & đồng hành",
    description:
      "Trao đổi trong lớp, nhận thông báo và giúp phụ huynh theo dõi tình hình học tập, điểm danh của con.",
    tone: "bg-amber-50 text-amber-700",
  },
  {
    icon: ShieldCheck,
    title: "Quản lý & phân quyền",
    description:
      "Quản lý tài khoản, dữ liệu học vụ và quyền truy cập để mỗi người sử dụng đúng chức năng được cấp.",
    tone: "bg-rose-50 text-rose-700",
  },
];

const audiences = [
  {
    icon: GraduationCap,
    title: "Người học",
    subtitle: "Chủ động trong từng bước học",
    benefits: [
      "Truy cập lớp học và tài liệu theo môn",
      "Tham gia bài thi, xem điểm và kết quả",
      "Ôn tập với AI, theo dõi kế hoạch học tập",
    ],
  },
  {
    icon: BookOpen,
    title: "Giáo viên",
    subtitle: "Hiểu lớp học, hỗ trợ đúng lúc",
    benefits: [
      "Quản lý lớp, học liệu và điểm danh",
      "Tạo câu hỏi, tổ chức và phân tích bài thi",
      "Theo dõi tiến độ, giao kế hoạch hỗ trợ",
    ],
  },
  {
    icon: UsersRound,
    title: "Phụ huynh",
    subtitle: "Đồng hành cùng việc học của con",
    benefits: [
      "Xem tổng quan tình hình học tập của con",
      "Theo dõi điểm danh và kết quả học tập",
      "Nắm thông báo và cảnh báo học tập",
    ],
  },
  {
    icon: School,
    title: "Nhà trường",
    subtitle: "Tổ chức và vận hành tập trung",
    benefits: [
      "Quản lý tài khoản và phân quyền",
      "Tổ chức lớp, môn học và phân công",
      "Quản lý liên kết phụ huynh – người học",
    ],
  },
];

const steps = [
  {
    title: "Đăng nhập tài khoản",
    description:
      "Sử dụng tài khoản được nhà trường cấp và đăng nhập tại cổng dành cho vai trò của bạn.",
  },
  {
    title: "Khám phá không gian của bạn",
    description:
      "Xem lớp học, môn học, thông báo hoặc dữ liệu quản lý trong trang tổng quan.",
  },
  {
    title: "Bắt đầu và theo dõi tiến độ",
    description:
      "Học tập, tổ chức bài thi hoặc theo dõi kết quả. Xem hướng dẫn khi cần hỗ trợ thao tác.",
  },
];

const questions = [
  {
    question: "EStude là phần mềm gì?",
    answer:
      "EStude là nền tảng học tập và quản lý lớp học, kết nối học liệu, kiểm tra đánh giá, hỗ trợ ôn tập và theo dõi tiến độ. Người học, giáo viên, phụ huynh và quản trị viên có không gian sử dụng phù hợp với vai trò của mình.",
  },
  {
    question: "Làm thế nào để có tài khoản EStude?",
    answer:
      "Bạn sử dụng tài khoản do nhà trường hoặc quản trị viên cung cấp. Nếu chưa có tài khoản hoặc chưa rõ cổng đăng nhập, hãy liên hệ người phụ trách tại đơn vị của bạn.",
  },
  {
    question: "AI hỗ trợ việc học như thế nào?",
    answer:
      "Người học có thể ôn tập từ học liệu bằng flashcard, câu hỏi luyện tập và bản đồ kiến thức. Giáo viên có thể sử dụng AI để hỗ trợ tạo câu hỏi, sau đó kiểm tra và duyệt nội dung trước khi đưa vào sử dụng.",
  },
  {
    question: "Tôi có thể xem hướng dẫn sử dụng ở đâu?",
    answer:
      "Truy cập mục Hướng dẫn để tìm nội dung theo vai trò và chức năng. Các chức năng hiển thị trong tài khoản phụ thuộc vào quyền được quản trị viên cấp.",
  },
];

function WorkspacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
      <div aria-hidden="true" className="absolute -inset-4 rounded-[40px] bg-gradient-to-br from-blue-200/60 to-cyan-100/60 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
            <LayoutDashboard aria-hidden="true" className="size-4 text-brand-600" />
            Không gian EStude
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">Minh họa chức năng</span>
        </div>
        <div className="p-5 sm:p-6">
          <div className="rounded-2xl bg-ink p-5 text-white sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">Cùng nhau tiến bộ</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Kết nối một hành trình học tập.</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Người học", "Giáo viên", "Phụ huynh", "Nhà trường"].map((role) => (
                <span key={role} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-blue-50">{role}</span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { icon: BookOpen, title: "Học liệu", text: "Kiến thức trong tầm tay", tone: "bg-blue-50 text-brand-700" },
              { icon: ClipboardCheck, title: "Bài thi", text: "Đánh giá để tiến bộ", tone: "bg-violet-50 text-violet-700" },
              { icon: Sparkles, title: "Trợ lý học tập AI", text: "Ôn tập theo học liệu", tone: "bg-cyan-50 text-cyan-700" },
              { icon: ChartNoAxesCombined, title: "Tiến độ", text: "Theo sát mục tiêu", tone: "bg-emerald-50 text-emerald-700" },
            ].map(({ icon: Icon, title, text, tone }) => (
              <div key={title} className="rounded-2xl border border-slate-100 p-4">
                <span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" className="size-4" /></span>
                <p className="mt-3 text-sm font-bold text-ink">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600" />
            <p className="text-sm leading-6 text-slate-600">Từ học trên lớp đến tự ôn tập, mọi bước đều được kết nối.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <a href="#noi-dung" className="sr-only z-50 rounded-lg bg-white p-3 font-semibold text-brand-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Đến nội dung chính</a>
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/about" aria-label="EStude – Giới thiệu tổng quan"><BrandLogo withShadow={false} /></Link>
          <nav aria-label="Điều hướng chính" className="flex items-center gap-1 sm:gap-2">
            <a href="#tinh-nang" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-brand-600 sm:inline-flex">Tính năng</a>
            <a href="#doi-tuong" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-brand-600 md:inline-flex">Dành cho ai?</a>
            <Link href="/help" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-brand-600">Hướng dẫn</Link>
            <Link href="/login" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 focus-visible:outline-brand-600">Đăng nhập</Link>
          </nav>
        </div>
      </header>

      <main id="noi-dung">
        <section aria-labelledby="overview-title" className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 to-white">
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-2 text-xs font-bold text-brand-700"><Sparkles aria-hidden="true" className="size-4" /> Không gian học tập kết nối</span>
              <h1 id="overview-title" className="mt-6 text-balance text-4xl font-extrabold leading-[1.15] tracking-[-0.045em] sm:text-5xl lg:text-[56px]">Học tập có định hướng.<br /><span className="text-brand-600">Tiến bộ cùng EStude.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">Một nền tảng để tổ chức lớp học, kiểm tra đánh giá và hỗ trợ học tập với AI. EStude giúp người học, giáo viên, phụ huynh và nhà trường cùng theo sát hành trình học tập.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 focus-visible:outline-brand-600">Bắt đầu sử dụng <ArrowRight aria-hidden="true" className="size-4" /></Link>
                <a href="#tinh-nang" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-brand-600">Khám phá tính năng <ArrowDown aria-hidden="true" className="size-4" /></a>
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-brand-600" /> Không gian riêng theo vai trò và quyền truy cập.</p>
            </div>
            <WorkspacePreview />
          </div>
        </section>

        <section aria-labelledby="purpose-title" className="border-y border-slate-100 bg-slate-50/70">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Về EStude</p>
              <h2 id="purpose-title" className="mt-3 text-balance text-2xl font-extrabold tracking-tight sm:text-3xl">Để việc dạy và học<br className="hidden sm:block" /> được kết nối mỗi ngày.</h2>
            </div>
            <div className="space-y-4 text-base leading-8 text-slate-600">
              <p>EStude tập trung những hoạt động thường ngày của lớp học vào một nơi: từ chia sẻ tài liệu, điểm danh và trao đổi đến tổ chức bài thi, xem kết quả và ôn tập.</p>
              <p>Khi thông tin được kết nối, người học biết mình cần cải thiện điều gì, giáo viên có thêm cơ sở để hỗ trợ, còn phụ huynh có thể đồng hành cùng việc học của con.</p>
            </div>
          </div>
        </section>

        <section id="tinh-nang" aria-labelledby="features-title" className="mx-auto max-w-7xl scroll-mt-32 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Tính năng nổi bật</p>
            <h2 id="features-title" className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Từ quản lý lớp học<br />đến hỗ trợ từng người học.</h2>
            <p className="mt-4 leading-7 text-slate-600">Các công cụ bổ trợ cho nhau, giúp việc dạy, học và theo dõi kết quả trở nên rõ ràng hơn.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description, tone }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-card">
                <span className={`grid size-12 place-items-center rounded-2xl ${tone}`}><Icon aria-hidden="true" className="size-6" /></span>
                <h3 className="mt-5 text-lg font-bold tracking-tight">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="doi-tuong" aria-labelledby="audience-title" className="scroll-mt-32 bg-ink text-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Một nền tảng, bốn vai trò</p>
              <h2 id="audience-title" className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Mỗi người một vai trò.<br />Cùng hướng đến sự tiến bộ.</h2>
              <p className="mt-4 leading-7 text-slate-300">Thông tin và công cụ phù hợp cho từng người tham gia vào quá trình học tập.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {audiences.map(({ icon: Icon, title, subtitle, benefits }) => (
                <article key={title} className="rounded-2xl border border-white/15 bg-white/[0.05] p-5 sm:p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-blue-400/15 text-blue-200"><Icon aria-hidden="true" className="size-5" /></span>
                  <h3 className="mt-5 text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-blue-200">{subtitle}</p>
                  <ul className="mt-5 space-y-3">
                    {benefits.map((benefit) => <li key={benefit} className="flex items-start gap-2 text-sm leading-6 text-slate-300"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-cyan-300" /><span>{benefit}</span></li>)}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="steps-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Bắt đầu với EStude</p>
            <h2 id="steps-title" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Sẵn sàng trong ba bước.</h2>
          </div>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map(({ title, description }, index) => (
              <li key={title} className="border-t border-slate-200 pt-6">
                <span className="grid size-10 place-items-center rounded-full bg-brand-50 text-sm font-extrabold text-brand-700">0{index + 1}</span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq-title" className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Tìm hiểu thêm</p>
              <h2 id="faq-title" className="mt-3 text-3xl font-extrabold tracking-tight">Bạn muốn biết thêm?</h2>
              <p className="mt-4 leading-7 text-slate-600">Một vài thông tin hữu ích trước khi bắt đầu sử dụng EStude.</p>
              <Link href="/help" className="mt-6 inline-flex items-center gap-2 rounded-lg py-2 text-sm font-bold text-brand-700 hover:text-brand-800 focus-visible:outline-brand-600">Xem hướng dẫn sử dụng <ArrowRight aria-hidden="true" className="size-4" /></Link>
            </div>
            <div className="space-y-3">
              {questions.map(({ question, answer }) => (
                <details key={question} className="group rounded-2xl border border-slate-200 bg-white p-5 open:border-brand-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded font-bold text-ink focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden"><span>{question}</span><ChevronDown aria-hidden="true" className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" /></summary>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="start-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-12 text-center text-white sm:px-12">
            <GraduationCap aria-hidden="true" className="mx-auto size-10 text-blue-200" />
            <h2 id="start-title" className="mt-5 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">Mỗi ngày học tốt hơn, cùng EStude.</h2>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-blue-100">Đăng nhập bằng tài khoản được cấp để khám phá không gian học tập và các công cụ dành cho bạn.</p>
            <Link href="/login" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 transition hover:bg-blue-50 focus-visible:outline-white">Đăng nhập EStude <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div><BrandLogo withShadow={false} /><p className="mt-3 text-sm text-slate-500">Học tập kết nối. Đồng hành để tiến bộ.</p></div>
          <nav aria-label="Liên kết cuối trang" className="flex gap-5 text-sm font-semibold text-slate-600"><Link href="/about" aria-current="page" className="text-brand-700 hover:underline">Giới thiệu</Link><Link href="/help" className="hover:text-brand-700">Hướng dẫn</Link><Link href="/login" className="hover:text-brand-700">Đăng nhập</Link></nav>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} EStude.</p>
        </div>
      </footer>
    </div>
  );
}
