import { portalRedirect as redirect } from "@/lib/portal-redirect";

export default async function SubjectAssignmentsPage() {
  return redirect("/admin/course-offerings");
}
