import type { Metadata } from "next";
import { StaffLoginForm } from "@/components/auth/admin-login-form";

export const metadata: Metadata = {
  title: "Đăng nhập phụ huynh",
  description: "Đăng nhập vào cổng thông tin phụ huynh EStude.",
};

export default function ParentLoginPage() {
  return <StaffLoginForm role="PARENT" />;
}
