import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudyCoachKnowledgeMapPage } from "@/components/student/study-coach-knowledge-map-page";

export const metadata: Metadata = { title: "Knowledge Map · AI Study Coach" };
export default function StudyCoachKnowledgeMapRoute() { return <RoleGate allowedRole="STUDENT"><StudyCoachKnowledgeMapPage /></RoleGate>; }
