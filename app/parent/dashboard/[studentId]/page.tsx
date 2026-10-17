import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleGate } from "@/components/auth/role-gate";
import { ParentDashboard } from "@/components/parent/parent-dashboard";

export const metadata: Metadata = {
  title: "Thông tin học sinh | Cổng phụ huynh",
};

export default async function ParentStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) notFound();
  return (
    <RoleGate allowedRole="PARENT">
      <ParentDashboard key={studentId} studentId={studentId} />
    </RoleGate>
  );
}
