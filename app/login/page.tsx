import type { Metadata } from "next";
import { headers } from "next/headers";
import { StaffLoginForm } from "@/components/auth/admin-login-form";
import { getPortalRole, getRequestPortal } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập vào không gian học tập EStude.",
};

export default async function LoginPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const role = getPortalRole(getRequestPortal(host));

  return <StaffLoginForm role={role} />;
}
