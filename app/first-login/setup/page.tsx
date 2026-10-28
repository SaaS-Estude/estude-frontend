import type { Metadata } from "next";
import { FirstLoginSetupForm } from "@/components/auth/first-login-setup-form";

export const metadata: Metadata = {
  title: "Đổi mật khẩu được cấp",
  description: "Đổi mật khẩu được cấp trước khi tiếp tục sử dụng EStude.",
};

export default function FirstLoginSetupPage() {
  return <FirstLoginSetupForm />;
}
