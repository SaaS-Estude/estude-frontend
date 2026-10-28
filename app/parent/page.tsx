import { portalRedirect as redirect } from "@/lib/portal-redirect";

export default async function ParentPage() {
  return redirect("/parent/dashboard");
}
