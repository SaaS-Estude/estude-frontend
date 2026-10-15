import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { PermissionsProvider } from "@/context/permissions-context";
import { ActionNotificationProvider } from "@/components/ui/action-notification";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "EStude | Không gian học tập số",
  description: "Nền tảng học tập và quản lý lớp học dành cho sinh viên IUH.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi">
      <body className={inter.variable} suppressHydrationWarning>
        <AuthProvider>
          <PermissionsProvider>
            <ActionNotificationProvider>{children}</ActionNotificationProvider>
          </PermissionsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
