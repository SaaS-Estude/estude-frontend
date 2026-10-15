import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { LearningSupportInboxPage } from "@/components/assessment/learning-support-inbox-page";

export const metadata: Metadata = {
  title: "Hộp thư hỗ trợ học sinh",
  description: "Tiếp nhận và phản hồi yêu cầu hỗ trợ trong lộ trình học.",
};

export default function TeacherSupportRequestsRoute() {
  return (
    <RoleGate allowedRole="TEACHER">
      <LearningSupportInboxPage />
    </RoleGate>
  );
}
