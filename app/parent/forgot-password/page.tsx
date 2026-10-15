import type { Metadata } from "next";
import { PasswordRecoveryPage } from "@/components/auth/password-recovery-page";

export const metadata: Metadata = { title: "Quên mật khẩu phụ huynh" };

export default function ParentForgotPasswordPage() {
  return <PasswordRecoveryPage role="PARENT" />;
}
