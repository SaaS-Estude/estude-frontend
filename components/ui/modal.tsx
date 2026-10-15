"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const openModalStack: symbol[] = [];
let bodyScrollLockCount = 0;
let bodyOverflowBeforeModal = "";

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  width = "max-w-lg",
  titleClassName,
  bodyClassName,
  footerClassName,
  layerClassName,
  compact = false,
  mobileSheet = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: string;
  titleClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  layerClassName?: string;
  compact?: boolean;
  mobileSheet?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const modalIdRef = useRef(Symbol("modal"));
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const modalId = modalIdRef.current;
    openModalStack.push(modalId);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openModalStack.at(-1) === modalId) {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    if (bodyScrollLockCount === 0) {
      bodyOverflowBeforeModal = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    bodyScrollLockCount += 1;

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const stackIndex = openModalStack.lastIndexOf(modalId);
      if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = bodyOverflowBeforeModal;
      }
    };
  }, [open]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className={cn("modal-backdrop-enter fixed inset-0 grid overflow-y-auto bg-slate-950/10 backdrop-blur-[1px]", mobileSheet ? "items-end p-0 sm:place-items-center sm:p-4" : "place-items-center p-4", layerClassName ?? "z-[100]")}>
      <button
        className="absolute inset-0"
        type="button"
        onClick={onClose}
        aria-label="Đóng hộp thoại"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "modal-panel-enter relative w-full border border-slate-200 bg-white shadow-2xl",
          mobileSheet ? "max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:my-auto sm:rounded-2xl" : "my-auto rounded-2xl",
          width,
        )}
      >
        <header
          className={cn(
            "flex items-start justify-between gap-4 border-b border-slate-100",
            compact ? "px-4 py-2.5" : "px-5 py-4",
          )}
        >
          <div>
            <h2
              id={titleId}
              className={cn(
                compact ? "text-base font-extrabold text-slate-950" : "text-lg font-extrabold text-slate-950",
                titleClassName,
              )}
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "shrink-0 !rounded-full !px-0 text-slate-500",
              compact ? "!size-9" : "!size-10",
            )}
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng"
          >
            <X size={compact ? 22 : 28} strokeWidth={2.5} />
          </Button>
        </header>
        <div className={cn(compact ? "p-3" : "p-5", bodyClassName)}>{children}</div>
        {footer ? (
          <footer
            className={cn(
              "flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4",
              footerClassName,
            )}
          >
            {footer}
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
