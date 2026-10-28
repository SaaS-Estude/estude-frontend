import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { PermissionsProvider } from "@/context/permissions-context";
import { ActionNotificationProvider } from "@/components/ui/action-notification";
import "./globals.css";
import { TenantProvider } from "@/context/tenant-context";
import { headers } from "next/headers";
import { getPortalFromHost } from "@/lib/portal";
import { PortalRoutingProvider } from "@/context/portal-routing-context";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "EStude | Không gian học tập số",
  description: "Nền tảng học tập và quản lý lớp học dành cho học sinh IUH.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();
  const portal = getPortalFromHost(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"));
  return (
    <html lang="vi">
      <body className={inter.variable} suppressHydrationWarning>
        <PortalRoutingProvider portal={portal}>
          <TenantProvider>
            <AuthProvider>
              <PermissionsProvider>
                <ActionNotificationProvider>
                  {children}
                </ActionNotificationProvider>
              </PermissionsProvider>
            </AuthProvider>
          </TenantProvider>
        </PortalRoutingProvider>
      </body>
    </html>
  );
}
