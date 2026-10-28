import { FEATURES } from "@/lib/features";
import type { Metadata } from "next";
import { portalRedirect as redirect } from "@/lib/portal-redirect";
import { RoleGate } from "@/components/auth/role-gate";

export const metadata: Metadata = {
  title: "Ôn tập cùng AI",
  description: "Lộ trình ôn tập cá nhân hóa từ kết quả bài kiểm tra của học sinh.",
};

export default function StudentReviewRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <ReviewRedirect />
    </RoleGate>
  );
}

async function ReviewRedirect() {
  return redirect(FEATURES.examAnalysis ? "/student/study-coach#exam-review" : "/student/study-coach");
}
