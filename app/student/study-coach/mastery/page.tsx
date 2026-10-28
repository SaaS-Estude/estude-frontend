import type { Metadata } from "next";
import { portalRedirect as redirect } from "@/lib/portal-redirect";

export const metadata: Metadata = { title: "Năng lực học tập · AI Study Coach" };

export default async function StudyCoachMasteryRoute() {
  return redirect("/student/study-coach#mastery-by-document");
}
