import type { UserRole } from "@/types/auth";

export type AuthPortal = "admin" | "teacher" | "student" | "parent";

const PORTAL_ROLES: Record<AuthPortal, UserRole> = {
  admin: "ADMIN",
  teacher: "TEACHER",
  student: "STUDENT",
  parent: "PARENT",
};

const LOCAL_PORTALS: Record<string, AuthPortal> = {
  "3000": "admin",
  "3001": "teacher",
  "3002": "student",
  "3003": "parent",
};

function parsePortal(value: string | null | undefined): AuthPortal | null {
  const portal = value?.trim().toLowerCase();
  return portal === "admin" || portal === "teacher" || portal === "student" || portal === "parent"
    ? portal
    : null;
}

function getDevelopmentPortal(): AuthPortal | null {
  if (process.env.NODE_ENV !== "development") return null;
  return parsePortal(process.env.NEXT_PUBLIC_AUTH_PORTAL);
}

export function isDevelopmentHome(): boolean {
  return process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_AUTH_PORTAL === "home";
}

export function getPortalFromHost(host: string | null): AuthPortal | null {
  // Home runs independently of role portals, including local port detection.
  if (isDevelopmentHome()) return null;
  const developmentPortal = getDevelopmentPortal();
  if (developmentPortal) return developmentPortal;
  if (!host) return null;

  const forwardedHost = host.split(",", 1)[0]?.trim().toLowerCase();
  if (!forwardedHost) return null;

  try {
    const url = new URL(`http://${forwardedHost}`);
    if (
      process.env.NODE_ENV === "development" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      LOCAL_PORTALS[url.port]
    ) {
      return LOCAL_PORTALS[url.port];
    }

    if (
      url.hostname.endsWith(".estude.io.vn") ||
      (process.env.NODE_ENV === "development" && url.hostname.endsWith(".localhost"))
    ) {
      const subdomain = url.hostname.split(".", 1)[0];
      if (subdomain === "admin" || subdomain === "teacher" || subdomain === "student" || subdomain === "parent") {
        return subdomain;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getPortalFromPathname(pathname: string): AuthPortal | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (
    firstSegment === "admin" ||
    firstSegment === "teacher" ||
    firstSegment === "student"
    || firstSegment === "parent"
  ) {
    return firstSegment;
  }
  return null;
}

export function getCurrentPortal(): AuthPortal {
  if (typeof window !== "undefined") {
    return (
      getPortalFromHost(window.location.host) ??
      getPortalFromPathname(window.location.pathname) ??
      "student"
    );
  }
  return "student";
}

export function getRequestPortal(host: string | null): AuthPortal {
  return getPortalFromHost(host) ?? "student";
}

export function getPortalRole(portal: AuthPortal): UserRole {
  return PORTAL_ROLES[portal];
}

export function getCurrentPortalRole(): UserRole {
  return getPortalRole(getCurrentPortal());
}
