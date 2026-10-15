import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { TeacherSettingsPage } from "@/components/teacher/teacher-settings-page";
import { ActionNotificationProvider } from "@/components/ui/action-notification";

export const metadata: Metadata = {
  title: "Cấu hình giáo viên",
  description: "Thiết lập cấu hình mặc định dành riêng cho giáo viên.",
};

export default function TeacherExamDefaultsSettingsRoute() {
  return (
    <RoleGate allowedRole="TEACHER">
      <ActionNotificationProvider>
        <TeacherSettingsPage />
      </ActionNotificationProvider>
    </RoleGate>
  );
}
