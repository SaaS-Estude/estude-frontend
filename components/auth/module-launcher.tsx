"use client";
import Link from "next/link";
import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { usePermissions } from "@/context/permissions-context";
import { MODULE_LINKS } from "@/lib/permissions";
import { Modal } from "@/components/ui/modal";

export function ModuleLauncher() {
  const { user } = useAuth();
  const { can, loading } = usePermissions();
  const [open, setOpen] = useState(false);
  if (!user || loading) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Chức năng được cấp quyền"
        aria-label="Mở danh sách chức năng"
        className="fixed bottom-4 right-4 z-40 rounded-full bg-brand-600 p-3 text-white shadow-lg"
      >
        <LayoutGrid className="size-5" />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Chức năng được cấp quyền"
        width="max-w-3xl"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULE_LINKS.filter((item) => can(item.permission)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-200 p-3 text-sm font-semibold text-brand-700 hover:bg-blue-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </Modal>
    </>
  );
}
