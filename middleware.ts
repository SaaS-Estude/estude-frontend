import { NextRequest, NextResponse } from "next/server";
import { getPortalFromHost, type AuthPortal } from "./lib/portal";

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
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const portal = getPortalFromHost(host);
  if (!portal) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  const internalLoginPath = portal === "student" ? LOGIN_PATH : `/${portal}/login`;
  if (request.nextUrl.pathname === internalLoginPath && internalLoginPath !== LOGIN_PATH) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  if (request.nextUrl.pathname === LOGIN_PATH) {
    if (portal === "student") {
      return NextResponse.next({
        request: { headers: withPortalHeader(request, portal) },
      });
    }

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = internalLoginPath;
    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: withPortalHeader(request, portal) },
    });
  }

  if (!isPortalPath(request.nextUrl.pathname, portal)) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  return NextResponse.next({
    request: { headers: withPortalHeader(request, portal) },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)"],
};
