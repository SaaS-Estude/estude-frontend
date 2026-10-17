import { FEATURES } from "@/lib/features";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RoleGate } from "@/components/auth/role-gate";

export const metadata: Metadata = {
  title: "Ôn tập cùng AI",
  description: "Lộ trình ôn tập cá nhân hóa từ kết quả bài kiểm tra của sinh viên.",
};

export default function StudentReviewRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <ReviewRedirect />
    </RoleGate>
  );
}

function ReviewRedirect() {
  redirect(FEATURES.examAnalysis ? "/student/study-coach#exam-review" : "/student/study-coach");
  return null;
}
