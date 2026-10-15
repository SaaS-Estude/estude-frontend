import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { ParentDashboard } from "@/components/parent/parent-dashboard";

export const metadata: Metadata = {
  title: "Cổng phụ huynh",
  description: "Theo dõi thông tin học tập của học sinh trên EStude.",
};

export default function ParentDashboardPage() {
  return <RoleGate allowedRole="PARENT"><ParentDashboard /></RoleGate>;
}
