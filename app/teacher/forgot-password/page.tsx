import type { Metadata } from "next";
import { PasswordRecoveryPage } from "@/components/auth/password-recovery-page";

export const metadata: Metadata = { title: "Quên mật khẩu giảng viên" };

export default function TeacherForgotPasswordPage() {
  return <PasswordRecoveryPage role="TEACHER" />;
}
