import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudyCoachMaterialDetailPage } from "@/components/student/study-coach-material-detail-page";

export const metadata: Metadata = { title: "Chi tiết tài liệu · AI Study Coach" };
export default function StudyCoachMaterialRoute() { return <RoleGate allowedRole="STUDENT"><StudyCoachMaterialDetailPage /></RoleGate>; }
