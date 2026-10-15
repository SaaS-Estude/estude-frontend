import { GraduationCap } from "lucide-react";

export function BrandLogo({
  inverse = false,
  withShadow = true,
}: {
  inverse?: boolean;
  withShadow?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-3" aria-label="EStude">
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
        E
        <span className={inverse ? "text-brand-200" : "text-brand-600"}>
          Stude
        </span>
      </span>
    </div>
  );
}
