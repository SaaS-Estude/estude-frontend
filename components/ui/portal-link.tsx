"use client";

import NextLink from "next/link";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { useRoutingPortal } from "@/context/portal-routing-context";
import { publicPortalHref } from "@/lib/portal-routes";

const PortalLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<typeof NextLink>>(
  function PortalLink({ href, as, ...props }, ref) {
    const portal = useRoutingPortal();
    return <NextLink {...props} ref={ref} href={publicPortalHref(href, portal)} as={as ? publicPortalHref(as, portal) : undefined} />;
  },
);

export default PortalLink;
