"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonProps["variant"];
}

export function ConfirmationDialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  loading = false,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  confirmVariant = "primary",
}: ConfirmationDialogProps) {
  function handleClose() {
    if (!loading) onClose();
  }

  return (
    <Modal
      open={open}
      title={title}
      width="max-w-lg"
      titleClassName="!text-base !font-semibold !text-brand-700 uppercase tracking-wide"
      bodyClassName="px-6 py-6"
      footerClassName="gap-3 px-6 py-4"
      onClose={handleClose}
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-11 min-w-24 border-brand-500 px-3 text-sm text-brand-700 hover:bg-blue-50"
            disabled={loading}
            onClick={handleClose}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
            className="h-12 min-w-24 px-3 text-sm"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-6 text-slate-800">{children}</div>
    </Modal>
  );
}
