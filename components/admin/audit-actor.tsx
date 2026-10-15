import type { User } from "@/types/auth";

export function AuditActor({ user }: { user: User }) {
  const actorName = user.updatedByFullName ?? user.updatedByAccountName;
  if (!actorName) return <span className="text-slate-400">--</span>;

  const initial = actorName.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="flex min-w-48 items-center gap-2.5"
      title={user.updatedByAccountName ?? actorName}
    >
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-200 bg-cover bg-center text-xs font-bold text-slate-700 ring-1 ring-slate-200"
        style={
          user.updatedByAvatarUrl
            ? { backgroundImage: `url("${user.updatedByAvatarUrl}")` }
            : undefined
        }
        aria-hidden="true"
      >
        {user.updatedByAvatarUrl ? null : initial}
      </span>
      <span className="text-[13px] font-semibold uppercase text-slate-800">
        {actorName}
      </span>
    </div>
  );
}
