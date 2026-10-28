"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AuthPortal } from "@/lib/portal";

const PortalRoutingContext = createContext<AuthPortal | null>(null);

export function PortalRoutingProvider({ portal, children }: { portal: AuthPortal | null; children: ReactNode }) {
  return <PortalRoutingContext.Provider value={portal}>{children}</PortalRoutingContext.Provider>;
}

export function useRoutingPortal() {
  return useContext(PortalRoutingContext);
}
