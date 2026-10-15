import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudentCourseDetailPage } from "@/components/student/student-course-pages";

export const metadata: Metadata = {
  title: "Chi tiết môn học",
  description: "Nội dung học tập và bài kiểm tra của môn học.",
};

export default function StudentCourseDetailRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentCourseDetailPage />
    </RoleGate>
  );
}
