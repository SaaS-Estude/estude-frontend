"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AtSign,
  Camera,
  IdCard,
  LoaderCircle,
  Mail,
  Phone,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { useActionNotification } from "@/components/ui/action-notification";
import { useAuth } from "@/context/auth-context";
import { ApiError, authApi } from "@/lib/auth-api";

const roleLabels = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giảng viên",
  STUDENT: "Sinh viên",
  PARENT: "Phụ huynh",
} as const;

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, updateUser } = useAuth();
  const { notify } = useActionNotification();
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setEmail(user?.email ?? "");
    setPhoneNumber(user?.phoneNumber ?? "");
    setError("");
  }, [open, user?.email, user?.phoneNumber]);

  if (!user) return null;

  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  function getErrorMessage(cause: unknown, fallback: string): string {
    if (cause instanceof ApiError) return cause.details[0] ?? cause.message;
    return cause instanceof Error ? cause.message : fallback;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await authApi.updateProfile({
        email: email.trim() || null,
        phoneNumber: phoneNumber.trim() || null,
      });
      updateUser(updated);
      notify("Đã cập nhật thông tin liên hệ", { key: "profile-updated" });
      onClose();
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể cập nhật hồ sơ."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Ảnh đại diện chỉ hỗ trợ định dạng JPG, PNG hoặc WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Dung lượng ảnh đại diện không được vượt quá 2 MB.");
      return;
    }

    setUpdatingAvatar(true);
    setError("");
    try {
      const updated = await authApi.updateAvatar(file);
      updateUser(updated);
      notify("Đã cập nhật ảnh đại diện", { key: "avatar-updated" });
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể cập nhật ảnh đại diện."));
    } finally {
      setUpdatingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!user?.avatarUrl || !window.confirm("Xóa ảnh đại diện hiện tại?")) return;
    setUpdatingAvatar(true);
    setError("");
    try {
      const updated = await authApi.removeAvatar();
      updateUser(updated);
      notify("Đã xóa ảnh đại diện", { key: "avatar-removed" });
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể xóa ảnh đại diện."));
    } finally {
      setUpdatingAvatar(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Hồ sơ cá nhân"
      description="Quản lý ảnh đại diện và thông tin liên hệ dùng trong EStude."
      width="max-w-4xl"
      bodyClassName="max-h-[calc(100dvh-9rem)] overflow-y-auto !p-4 sm:!p-6"
      onClose={() => !saving && !updatingAvatar && onClose()}
    >
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
          <div className="relative mx-auto size-28 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/20">
            {user.avatarUrl ? (
              <span
                role="img"
                aria-label={`Ảnh đại diện của ${user.fullName}`}
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${user.avatarUrl})` }}
              />
            ) : (
              <span className="grid size-full place-items-center text-3xl font-extrabold">{initials}</span>
            )}
            {updatingAvatar ? (
              <span className="absolute inset-0 grid place-items-center bg-slate-950/55">
                <LoaderCircle className="size-7 animate-spin" />
              </span>
            ) : null}
          </div>
          <h3 className="mt-4 font-extrabold text-slate-900">{user.fullName}</h3>
          <p className="mt-1 text-sm font-semibold text-brand-700">{roleLabels[user.role]}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void handleAvatarChange(event)}
          />
          <div className="mt-5 grid gap-2">
            <Button variant="outline" disabled={updatingAvatar} onClick={() => fileInputRef.current?.click()}>
              <Camera className="size-4" /> {user.avatarUrl ? "Đổi ảnh" : "Tải ảnh lên"}
            </Button>
            {user.avatarUrl ? (
              <Button variant="danger" disabled={updatingAvatar} onClick={() => void handleRemoveAvatar()}>
                <Trash2 className="size-4" /> Xóa ảnh
              </Button>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">JPG, PNG hoặc WebP · Tối đa 2 MB</p>
        </aside>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-brand-700">
              <UserRound className="size-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900">Thông tin tài khoản</h3>
              <p className="text-sm text-slate-500">Họ tên và mã tài khoản do nhà trường quản lý.</p>
            </div>
          </div>

          {error ? (
            <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input label="Họ và tên" icon={IdCard} value={user.fullName} disabled />
            <Input label="Mã tài khoản" icon={AtSign} value={user.accountName} disabled />
            <Input label="Email" icon={Mail} type="email" value={email} maxLength={254} placeholder="Nhập email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
            <Input label="Số điện thoại" icon={Phone} type="tel" value={phoneNumber} maxLength={20} placeholder="Ví dụ: 0901 234 567" autoComplete="tel" onChange={(event) => setPhoneNumber(event.target.value)} />
          </div>

          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <Button type="submit" className="h-11 px-6" disabled={saving || updatingAvatar}>
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
