"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "@/lib/portal-navigation";
import { ArrowLeft, CalendarClock, ExternalLink, Video } from "lucide-react";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { MeetingPasscode } from "./meeting-passcode";
import {
  onlineSessionApi,
  type OnlineSession,
} from "@/lib/online-sessions-api";
import {
  canEnterOnline,
  onlineLiveState,
  onlineStateLabels,
  onlineTime,
} from "@/lib/online-session-view";

export function StudentOnlineSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<OnlineSession | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<{ id: string; revision: number; passcode: string; roomUrl?: string } | null>(null);
  const [clock, setClock] = useState(Date.now());
  const offset = useRef(0);
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await onlineSessionApi.detail("student", id);
      offset.current = Date.parse(data.serverNow) - Date.now();
      setClock(Date.now() + offset.current);
      setRow(data);
    } catch (cause) {
      setRow(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tìm thấy buổi học hoặc lời mời không còn hiệu lực.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(
      () => setClock(Date.now() + offset.current),
      10000,
    );
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [load]);
  async function join() {
    if (!row || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const access = await onlineSessionApi.join("student", row.id);
      setAccess({ id: row.id, revision: row.revision, passcode: access.meetingPasscode ?? "", roomUrl: tab ? undefined : access.url });
      if (tab) tab.location.href = access.url;
      else if (!access.meetingPasscode) window.location.assign(access.url);
    } catch (cause) {
      setAccess(null);
      tab?.close();
      setError(
        cause instanceof Error ? cause.message : "Không vào được buổi học",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <StudentShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/student/calendar")}
        >
          <ArrowLeft className="size-4" />
          Lịch học tập
        </Button>
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700"
          >
            {error}
            <Button variant="ghost" onClick={() => void load()}>
              Tải lại
            </Button>
          </p>
        ) : null}
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Đang tải buổi học…
          </p>
        ) : row ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-brand-600">
                <Video className="size-6" />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-600">
                  {row.platform === "MEET" ? "Google Meet" : "Zoom"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {onlineStateLabels[onlineLiveState(row, clock)]}
                </p>
              </div>
            </div>
            <h1 className="mt-6 text-2xl font-extrabold text-slate-950">
              {row.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{row.courseName}</p>
            <p className="mt-2 text-sm text-slate-600">
              Giáo viên: <b>{row.organizerName}</b>
            </p>
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
              <CalendarClock className="mt-0.5 size-4 shrink-0" />
              {onlineTime(row.startsAt)} – {onlineTime(row.endsAt)}
            </p>
            {row.description ? (
              <p className="mt-5 whitespace-pre-wrap leading-7 text-slate-600">
                {row.description}
              </p>
            ) : null}
            {row.status === "CANCELLED" ? (
              <p className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                Buổi học đã hủy: {row.cancelReason}
              </p>
            ) : (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <Button
                  disabled={!canEnterOnline(row, clock) || busy}
                  onClick={() => void join()}
                >
                  <ExternalLink className="size-4" />
                  {busy ? "Đang mở phòng…" : "Vào học"}
                </Button>
                {access?.id === row.id && access.revision === row.revision && access.passcode && canEnterOnline(row, clock) ? <MeetingPasscode key={access.passcode} value={access.passcode} roomUrl={access.roomUrl} /> : null}
                <p className="mt-3 text-sm text-slate-500">
                  {clock >= Date.parse(row.endsAt)
                    ? "Buổi học đã kết thúc."
                    : `Có thể vào học từ ${onlineTime(row.joinOpensAt)}. Phòng học mở trên ${row.platform === "MEET" ? "Google Meet" : "Zoom"}.`}
                </p>
              </div>
            )}
          </article>
        ) : null}
      </div>
    </StudentShell>
  );
}
