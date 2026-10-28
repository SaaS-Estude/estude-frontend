import type { UrlObject } from "url";
import type { AuthPortal } from "./portal";

const workspacePrefix = /^\/(admin|teacher|student|parent)(?:\/|$)/;

/** Public URLs omit only the workspace already identified by the hostname. */
export function publicPortalPath(href: string, portal: AuthPortal | null): string {
  if (!portal || !href.startsWith("/") || href.startsWith("//")) return href;
  const end = href.search(/[?#]/);
  const pathname = end < 0 ? href : href.slice(0, end);
  const suffix = end < 0 ? "" : href.slice(end);
  const prefix = `/${portal}`;
  if (pathname === prefix || pathname === `${prefix}/`) return `/dashboard${suffix}`;
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) + suffix : href;
}

/** Resolve the public path back to the existing page tree and permission keys. */
export function workspacePortalPath(pathname: string, portal: AuthPortal | null): string {
  if (!portal || workspacePrefix.test(pathname)) return pathname;
  if (pathname === "/login") return portal === "student" ? pathname : `/${portal}/login`;
  if (
    pathname === "/" || pathname === "/about" || pathname === "/help" ||
    pathname === "/register" || pathname.startsWith("/first-login/") ||
    /^\/(api|_next|\.well-known)(?:\/|$)/.test(pathname)
  ) return pathname;
  return `/${portal}${pathname}`;
}

export function publicPortalHref(href: string | UrlObject, portal: AuthPortal | null): string | UrlObject {
  if (typeof href === "string") return publicPortalPath(href, portal);
  if (href.host || href.hostname || href.protocol || !href.pathname) return href;
  return { ...href, pathname: publicPortalPath(href.pathname, portal) };
}
