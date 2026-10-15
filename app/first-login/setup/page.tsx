import type { Metadata } from "next";
import { FirstLoginSetupForm } from "@/components/auth/first-login-setup-form";

export const metadata: Metadata = {
  title: "Thiết lập tài khoản lần đầu",
  description: "Đổi mật khẩu mặc định và xác thực email khôi phục EStude.",
};

export default function FirstLoginSetupPage() {
  return <FirstLoginSetupForm />;
}
