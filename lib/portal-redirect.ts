import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPortalFromHost } from "./portal";
import { publicPortalPath } from "./portal-routes";

export async function portalRedirect(href: string): Promise<never> {
  const requestHeaders = await headers();
  const portal = getPortalFromHost(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"));
  return redirect(publicPortalPath(href, portal));
}
