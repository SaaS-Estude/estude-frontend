"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { WORKSPACE_NAVIGATION_EVENT } from "@/lib/workspace-navigation";

const marker = "__estudeQuestionDraftGuard";

export function UnsavedQuestionChanges({
  dirty,
  busy,
  canSave,
  onSave,
}: {
  dirty: boolean;
  busy: boolean;
  canSave: boolean;
  onSave: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<{
    action: () => void;
    back?: boolean;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const bypass = useRef(false);
  const savingForLeave = useRef(false);
  const effectGeneration = useRef(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const state = useRef({ busy, onSave });
  state.current = { busy, onSave };

  useEffect(() => {
    const generation = ++effectGeneration.current;
    const isLatestEffect = () => generation === effectGeneration.current;
    if (!dirty) {
      if (!savingForLeave.current) setPending(null);
      if (
        !bypass.current &&
        !savingForLeave.current &&
        window.history.state?.[marker]
      ) {
        window.addEventListener(
          "popstate",
          (event) => event.stopImmediatePropagation(),
          { capture: true, once: true },
        );
        window.history.back();
      }
      return;
    }
    bypass.current = false;
    const url = window.location.href;
    let restoringHistory = false;
    // A temporary entry with the same route keeps the workspace mounted while Back is confirmed.
    const hadPreviousEntry = window.history.length > 1;
    if (hadPreviousEntry && !window.history.state?.[marker]) {
      window.history.pushState(
        { ...window.history.state, [marker]: true },
        "",
        url,
      );
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (bypass.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function request(event: Event) {
      if (bypass.current) return;
      event.preventDefault();
      const detail = (event as CustomEvent<{ action: () => void }>).detail;
      setSaveFailed(false);
      setPending({ action: detail.action });
    }
    function click(event: MouseEvent) {
      if (
        bypass.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      )
        return;
      const target = new URL(anchor.href, url);
      if (
        !["http:", "https:"].includes(target.protocol) ||
        target.href === url ||
        (target.origin === window.location.origin &&
          target.pathname === window.location.pathname &&
          target.search === window.location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setSaveFailed(false);
      setPending({
        action: () => {
          if (target.origin === window.location.origin)
            router.push(target.pathname + target.search + target.hash);
          else window.location.assign(target.href);
        },
      });
    }
    function pop(event: PopStateEvent) {
      if (bypass.current || !hadPreviousEntry) return;
      event.stopImmediatePropagation();
      if (restoringHistory) {
        restoringHistory = false;
        setRestoring(false);
        return;
      }
      restoringHistory = true;
      setRestoring(true);
      setSaveFailed(false);
      window.history.go(1);
      setPending({ back: true, action: () => window.history.go(-2) });
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener(WORKSPACE_NAVIGATION_EVENT, request);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener(WORKSPACE_NAVIGATION_EVENT, request);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", pop, true);
      // Strict Mode immediately installs the effect again; retain its entry in that case.
      queueMicrotask(() => {
        if (
          isLatestEffect() &&
          !bypass.current &&
          !savingForLeave.current &&
          window.history.state?.[marker]
        )
          window.history.back();
      });
    };
  }, [dirty, router]);

  function leave() {
    if (!pending) return;
    bypass.current = true;
    const next = pending;
    setPending(null);
    if (!next.back && window.history.state?.[marker]) {
      // Consume the guard entry before navigating so it does not create an extra Back step.
      window.addEventListener(
        "popstate",
        (event) => {
          event.stopImmediatePropagation();
          next.action();
        },
        { capture: true, once: true },
      );
      window.history.back();
    } else next.action();
  }
  async function saveAndLeave() {
    savingForLeave.current = true;
    setSaveFailed(false);
    const saved = await state.current.onSave();
    if (saved) leave();
    else setSaveFailed(true);
    savingForLeave.current = false;
  }
  return (
    <Modal
      open={pending !== null}
      title="Bạn có muốn hủy bỏ thay đổi?"
      footerClassName="flex-wrap"
      onClose={() => {
        if (!busy && !restoring) setPending(null);
      }}
      footer={
        <>
          <Button
            variant="ghost"
            className="shrink-0 whitespace-nowrap"
            disabled={busy || restoring}
            onClick={() => setPending(null)}
          >
            Ở lại
          </Button>
          <Button
            variant="danger"
            className="shrink-0 whitespace-nowrap"
            disabled={busy || restoring}
            onClick={leave}
          >
            Hủy thay đổi
          </Button>
          <Button
            permission="ai_questions.create"
            className="shrink-0 whitespace-nowrap"
            disabled={busy || restoring || !canSave}
            onClick={() => void saveAndLeave()}
          >
            {busy ? "Đang xử lý..." : "Lưu bản nháp"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        Các thay đổi chưa lưu sẽ mất nếu rời trang. Bạn có thể lưu bản nháp để
        tiếp tục sau.
      </p>
      {saveFailed ? (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          Không lưu được bản nháp. Các thay đổi vẫn được giữ; hãy thử lại hoặc ở
          lại để kiểm tra lỗi.
        </p>
      ) : null}
      {busy ? (
        <p className="mt-2 text-sm text-amber-700">
          Đợi thao tác đang chạy hoàn tất trước khi rời trang.
        </p>
      ) : null}
    </Modal>
  );
}
