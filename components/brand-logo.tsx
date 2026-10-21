"use client";
import { useTenant } from "@/context/tenant-context";
import { GraduationCap } from "lucide-react";

export function BrandLogo({
  inverse = false,
  withShadow = true,
  showTenantName = true,
}: {
  inverse?: boolean;
  withShadow?: boolean;
  showTenantName?: boolean;
}) {
  const tenant = useTenant();
  const name = showTenantName ? tenant?.branding.displayName || tenant?.name : undefined;
  return (
    <div
      className="inline-flex items-center gap-3"
      aria-label={name ? `EStude · ${name}` : "EStude"}
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
          inverse ? "bg-white text-brand-700" : "bg-brand-600 text-white"
        } ${
          withShadow
            ? inverse
              ? "shadow-lg shadow-blue-950/20"
              : "shadow-lg shadow-brand-600/25"
            : "shadow-none"
        }`}
      >
        <GraduationCap
          aria-hidden="true"
          className="size-6"
          strokeWidth={2.2}
        />
      </span>
      <span
        className={`text-2xl font-extrabold tracking-[-0.04em] ${inverse ? "text-white" : "text-ink"}`}
      >
        <span className="block">
          E
          <span className={inverse ? "text-brand-200" : "text-brand-600"}>
            Stude
          </span>
        </span>
        {name ? (
          <span
            className="block max-w-48 truncate text-xs font-medium tracking-normal"
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
