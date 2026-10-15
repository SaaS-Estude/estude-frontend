import type { Metadata } from "next";
import { StaffLoginForm } from "@/components/auth/admin-login-form";

export const metadata: Metadata = {
  title: "Đăng nhập học sinh",
  description: "Đăng nhập vào khu vực học sinh EStude.",
};

export default function StudentLoginPage() {
  return <StaffLoginForm role="STUDENT" />;
}
