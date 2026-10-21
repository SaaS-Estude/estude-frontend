"use client";
import Image from "next/image";
import { useState } from "react";
import { useTenant } from "@/context/tenant-context";
import { GraduationCap } from "lucide-react";

export function BrandLogo({
  inverse = false,
  withShadow = true,
  showTenantName = true,
  wrapTenantName = false,
}: {
  inverse?: boolean;
  withShadow?: boolean;
  showTenantName?: boolean;
  wrapTenantName?: boolean;
}) {
  const tenant = useTenant();
  const schoolName = tenant?.branding.displayName || tenant?.name;
  const name = showTenantName ? schoolName : undefined;
  const [failedLogo, setFailedLogo] = useState("");
  const logoUrl = tenant?.branding.logoUrl;
  const customLogo = logoUrl?.startsWith("/api/v1/tenant/logo?") && logoUrl !== failedLogo;
  return (
    <div
      className="inline-flex max-w-full items-center gap-3"
      aria-label={customLogo ? schoolName : name ? `EStude · ${name}` : "EStude"}
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
          customLogo ? "bg-white p-1" : inverse ? "bg-white text-brand-700" : "bg-brand-600 text-white"
        } ${
          withShadow
            ? inverse
              ? "shadow-lg shadow-blue-950/20"
              : "shadow-lg shadow-brand-600/25"
            : "shadow-none"
        }`}
      >
        {customLogo ? <Image unoptimized src={logoUrl!} width={44} height={44} alt="" className="size-full object-contain" onError={() => setFailedLogo(logoUrl!)} /> : <GraduationCap
          aria-hidden="true"
          className="size-6"
          strokeWidth={2.2}
        />}
      </span>
      <span
        className={`min-w-0 text-2xl font-extrabold tracking-[-0.04em] ${inverse ? "text-white" : "text-ink"}`}
      >
        {customLogo ? <span title={schoolName} className={`block text-sm font-bold leading-5 tracking-normal ${wrapTenantName ? "whitespace-normal break-words" : "line-clamp-2 max-w-48 break-words"}`}>{schoolName}</span> : <span className="block">
          E
          <span className={inverse ? "text-brand-200" : "text-brand-600"}>
            Stude
          </span>
        </span>}
        {name && !customLogo ? (
          <span
            className={`block text-xs font-medium tracking-normal ${wrapTenantName ? "whitespace-normal break-words leading-relaxed" : "max-w-48 truncate"}`}
            title={name}
          >
            {name}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function TenantName() {
  const tenant = useTenant();
  const name = tenant?.branding.displayName || tenant?.name;

  if (!name) return null;

  return (
    <p
      className="hidden max-w-[24vw] truncate text-sm font-semibold text-brand-600 sm:block xl:max-w-xs"
      aria-label="Tên trường"
      title={name}
    >
      {name}
    </p>
  );
}
