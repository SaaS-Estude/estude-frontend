import type { Metadata } from "next";
import { StaffLoginForm } from "@/components/auth/admin-login-form";

export const metadata: Metadata = {
  title: "Đăng nhập giảng viên",
  description: "Đăng nhập vào khu vực giảng viên EStude.",
};

export default function TeacherLoginPage() {
  return <StaffLoginForm role="TEACHER" />;
}
