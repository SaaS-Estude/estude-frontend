"use client";

import { useMemo } from "react";
import { useRouter as useNextRouter, usePathname } from "next/navigation";
import { useRoutingPortal } from "@/context/portal-routing-context";
import { publicPortalPath, workspacePortalPath } from "./portal-routes";

export { useParams, useSearchParams } from "next/navigation";

/** Keep all UI navigation canonical, including links returned by backend APIs. */
export function useRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter();
  const portal = useRoutingPortal();
  return useMemo<ReturnType<typeof useNextRouter>>(() => ({
    ...router,
    push: (href, options) => router.push(publicPortalPath(href, portal), options),
    replace: (href, options) => router.replace(publicPortalPath(href, portal), options),
    prefetch: (href, options) => router.prefetch(publicPortalPath(href, portal), options),
  }), [router, portal]);
}

/** Sidebar selection and RBAC continue to use the existing internal paths. */
export function useWorkspacePathname(): string {
  const pathname = usePathname();
  const portal = useRoutingPortal();
  return workspacePortalPath(pathname, portal);
}
