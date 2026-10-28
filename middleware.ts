import { NextRequest, NextResponse } from "next/server";
import { getPortalFromHost, type AuthPortal } from "./lib/portal";
import { publicPortalPath, workspacePortalPath } from "./lib/portal-routes";

const LOGIN_PATH = "/login";

function withPortalHeader(request: NextRequest, portal: AuthPortal): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-estude-portal", portal);
  return requestHeaders;
}

function isPortalPath(pathname: string, portal: AuthPortal): boolean {
  if (pathname === "/about" || pathname === "/help") return true;
  // Login identity stays portal-specific. Feature access is resolved by RBAC, not the host.
  if (/^\/(admin|teacher|student|parent)\//.test(pathname) && !pathname.endsWith('/login') && !pathname.endsWith('/forgot-password')) return true;
  if (pathname === "/dashboard") return true;
  if (pathname.startsWith("/first-login/")) return portal !== "admin";

  if (portal === "student") {
    return (
      pathname === "/login" ||
      pathname === "/register" ||
      pathname.startsWith("/first-login/") ||
      pathname === "/student" ||
      pathname.startsWith("/student/")
    );
  }

  return pathname === `/${portal}` || pathname.startsWith(`/${portal}/`);
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/.well-known/estude-domain") return NextResponse.next();
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const portal = getPortalFromHost(host);
  if (!portal) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  const publicPath = publicPortalPath(request.nextUrl.pathname, portal);
  if (publicPath !== request.nextUrl.pathname) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = publicPath;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const internalPath = workspacePortalPath(request.nextUrl.pathname, portal);
  if (!isPortalPath(internalPath, portal)) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  if (internalPath !== request.nextUrl.pathname) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = internalPath;
    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: withPortalHeader(request, portal) },
    });
  }

  return NextResponse.next({
    request: { headers: withPortalHeader(request, portal) },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)"],
};
