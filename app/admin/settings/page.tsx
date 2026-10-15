import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Cấu hình hệ thống",
  description: "Thiết lập các tham số chung của hệ thống EStude.",
};

export default function AdminSettingsPage() {
  redirect("/admin/settings/attendance");
}
