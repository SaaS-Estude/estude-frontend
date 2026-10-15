import type { Metadata } from "next";
import { PasswordRecoveryPage } from "@/components/auth/password-recovery-page";

export const metadata: Metadata = { title: "Quên mật khẩu học sinh" };

export default function StudentForgotPasswordPage() {
  return <PasswordRecoveryPage role="STUDENT" />;
}
