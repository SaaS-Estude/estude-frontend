import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Năng lực học tập · AI Study Coach" };

export default function StudyCoachMasteryRoute() {
  redirect("/student/study-coach#mastery-by-document");
}
