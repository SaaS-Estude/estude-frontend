"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export interface BarChartItem {
  id: string;
  label: string;
  shortLabel?: string;
  value: number | null;
  secondaryValue?: number | null;
  comparisonValue?: number | null;
  secondaryComparisonValue?: number | null;
  color?: string;
}

interface BarChartProps {
  items: BarChartItem[];
  ariaLabel: string;
  className?: string;
  maxItems?: number;
  maxValue?: number;
  emptyMessage?: string;
  secondaryColor?: string;
  secondaryLabel?: string;
  comparisonColor?: string;
  secondaryComparisonColor?: string;
  valueLabel?: string;
  comparisonLabel?: string;
  comparisonLegendLabel?: string;
  secondaryComparisonLabel?: string;
  secondaryComparisonLegendLabel?: string;
  valueFormatter?: (value: number) => string;
}

const DEFAULT_BAR_COLOR = "#3B82F6";
const DEFAULT_SECONDARY_COLOR = "#8B5CF6";
const DEFAULT_COMPARISON_COLOR = "#F59E0B";
const DEFAULT_SECONDARY_COMPARISON_COLOR = "#14B8A6";

function formatAxisTick(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function BarChart({
  items,
  ariaLabel,
  className,
  maxItems = 14,
  maxValue = 100,
  emptyMessage = "Chưa có dữ liệu để hiển thị.",
  secondaryColor = DEFAULT_SECONDARY_COLOR,
  secondaryLabel = "Giá trị trước",
  comparisonColor = DEFAULT_COMPARISON_COLOR,
  secondaryComparisonColor = DEFAULT_SECONDARY_COMPARISON_COLOR,
  valueLabel = "Giá trị",
  comparisonLabel = "Giá trị so sánh",
  comparisonLegendLabel,
  secondaryComparisonLabel = "Giá trị so sánh trước",
  secondaryComparisonLegendLabel,
  valueFormatter = (value) => `${value.toFixed(1)}%`,
}: BarChartProps) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const safeMaxValue = Math.max(maxValue, 1);
  const visibleItems = items.slice(0, Math.max(maxItems, 0));
  const hasSecondarySeries = visibleItems.some(
    (item) => item.secondaryValue !== undefined,
  );
  const hasActiveItem =
    activeItemId !== null &&
    visibleItems.some((item) => item.id === activeItemId);
  const ticks = [100, 75, 50, 25, 0].map(
    (percentage) => (safeMaxValue * percentage) / 100,
  );
  const comparisonPercentages = visibleItems.map((item) =>
    item.comparisonValue === null || item.comparisonValue === undefined
      ? null
      : (Math.min(Math.max(item.comparisonValue, 0), safeMaxValue) /
          safeMaxValue) *
        100,
  );
  const secondaryComparisonPercentages = visibleItems.map((item) =>
    item.secondaryComparisonValue === null ||
    item.secondaryComparisonValue === undefined
      ? null
      : (Math.min(
          Math.max(item.secondaryComparisonValue, 0),
          safeMaxValue,
        ) /
          safeMaxValue) *
        100,
  );
  const comparisonSegments = comparisonPercentages.reduce<number[][]>(
    (segments, percentage, index) => {
      if (percentage === null) return [...segments, []];
      const currentSegment = segments.at(-1) ?? [];
      currentSegment.push(
        index + (hasSecondarySeries ? 0.34 : 0.5),
        100 - percentage,
      );
      if (!segments.length) segments.push(currentSegment);
      return segments;
    },
    [],
  );
  const secondaryComparisonSegments =
    secondaryComparisonPercentages.reduce<number[][]>(
      (segments, percentage, index) => {
        if (percentage === null) return [...segments, []];
        const currentSegment = segments.at(-1) ?? [];
        currentSegment.push(index + 0.66, 100 - percentage);
        if (!segments.length) segments.push(currentSegment);
        return segments;
      },
      [],
    );
  const animationKey = visibleItems
    .map(
      (item) =>
        `${item.id}:${item.value ?? "null"}:${item.secondaryValue ?? "undefined"}:${item.comparisonValue ?? "null"}:${item.secondaryComparisonValue ?? "undefined"}`,
    )
    .join("|");

  if (!visibleItems.length) {
    return (
      <div
        className={cn(
          "grid h-full min-h-52 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 text-center text-[13px] font-semibold text-slate-500",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <figure
      className={cn(
        "flex h-full min-h-52 flex-col rounded-xl border border-slate-200 bg-white px-3 pb-2 pt-2",
        className,
      )}
      aria-label={ariaLabel}
    >
      <style>{`
        @keyframes estude-chart-bar-grow {
          from { clip-path: inset(100% 0 0 0); opacity: 0.45; }
          to { clip-path: inset(0 0 0 0); opacity: 1; }
        }

        @keyframes estude-chart-line-reveal {
          from { clip-path: inset(-8px 100% -8px -8px); opacity: 0.45; }
          to { clip-path: inset(-8px -8px -8px -8px); opacity: 1; }
        }

        @keyframes estude-chart-point-pop {
          from { opacity: 0; transform: translate(-50%, 50%) scale(0.4); }
          to { opacity: 1; transform: translate(-50%, 50%) scale(1); }
        }

        @keyframes estude-chart-label-fade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .estude-chart-motion { animation: none !important; }
        }
      `}</style>
      <div
        className="flex h-6 shrink-0 items-center justify-end gap-3 px-1 pb-1 text-[13px] font-semibold text-slate-500"
        aria-hidden="true"
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{
              backgroundColor:
                visibleItems.find((item) => item.value !== null)?.color ??
                DEFAULT_BAR_COLOR,
            }}
          />
          {valueLabel}
        </span>
        {hasSecondarySeries ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: secondaryColor }}
            />
            {secondaryLabel}
          </span>
        ) : null}
        {comparisonPercentages.some((percentage) => percentage !== null) ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="relative w-5 border-t-2"
              style={{ borderColor: comparisonColor }}
            >
              <span
                className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: comparisonColor }}
              />
            </span>
            {comparisonLegendLabel ?? comparisonLabel}
          </span>
        ) : null}
        {secondaryComparisonPercentages.some(
          (percentage) => percentage !== null,
        ) ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="relative w-5 border-t-2 border-dashed"
              style={{ borderColor: secondaryComparisonColor }}
            >
              <span
                className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: secondaryComparisonColor }}
              />
            </span>
            {secondaryComparisonLegendLabel ?? secondaryComparisonLabel}
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className="flex w-10 shrink-0 flex-col justify-between pb-8 pr-2 text-right text-[10px] font-semibold text-slate-400"
          aria-hidden="true"
        >
          {ticks.map((tick) => (
            <span key={tick}>{formatAxisTick(tick)}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div
            className="relative h-full"
            style={{ minWidth: `${Math.max(visibleItems.length * 52, 320)}px` }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 bottom-8 top-0 flex flex-col justify-between"
              aria-hidden="true"
            >
              {ticks.map((tick) => (
                <span key={tick} className="block border-t border-slate-100" />
              ))}
            </div>

            <div
              className="relative grid h-full"
              style={{
                gridTemplateColumns: `repeat(${visibleItems.length}, minmax(44px, 1fr))`,
              }}
              role="list"
            >
              <svg
                key={animationKey}
                className="estude-chart-motion pointer-events-none absolute inset-x-0 top-0 z-20 h-[calc(100%_-_2rem)] w-full overflow-visible"
                viewBox={`0 0 ${visibleItems.length} 100`}
                preserveAspectRatio="none"
                aria-hidden="true"
                style={{
                  animation:
                    "estude-chart-line-reveal 900ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both",
                }}
              >
                {comparisonSegments
                  .filter((segment) => segment.length >= 4)
                  .map((segment, index) => (
                    <polyline
                      key={index}
                      points={Array.from(
                        { length: segment.length / 2 },
                        (_, pointIndex) =>
                          `${segment[pointIndex * 2]},${segment[pointIndex * 2 + 1]}`,
                      ).join(" ")}
                      fill="none"
                      stroke={comparisonColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                {secondaryComparisonSegments
                  .filter((segment) => segment.length >= 4)
                  .map((segment, index) => (
                    <polyline
                      key={`secondary-${index}`}
                      points={Array.from(
                        { length: segment.length / 2 },
                        (_, pointIndex) =>
                          `${segment[pointIndex * 2]},${segment[pointIndex * 2 + 1]}`,
                      ).join(" ")}
                      fill="none"
                      stroke={secondaryComparisonColor}
                      strokeWidth="2"
                      strokeDasharray="6 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
              </svg>

              {visibleItems.map((item, itemIndex) => {
                const normalizedValue =
                  item.value === null
                    ? null
                    : Math.min(Math.max(item.value, 0), safeMaxValue);
                const percentage =
                  normalizedValue === null
                    ? 0
                    : (normalizedValue / safeMaxValue) * 100;
                const formattedValue =
                  item.value === null ? "--" : valueFormatter(item.value);
                const normalizedSecondaryValue =
                  item.secondaryValue === null ||
                  item.secondaryValue === undefined
                    ? null
                    : Math.min(
                        Math.max(item.secondaryValue, 0),
                        safeMaxValue,
                      );
                const secondaryPercentage =
                  normalizedSecondaryValue === null
                    ? 0
                    : (normalizedSecondaryValue / safeMaxValue) * 100;
                const formattedSecondaryValue =
                  item.secondaryValue === null ||
                  item.secondaryValue === undefined
                    ? "--"
                    : valueFormatter(item.secondaryValue);
                const comparisonPercentage = comparisonPercentages.at(itemIndex);
                const formattedComparisonValue =
                  item.comparisonValue === null ||
                  item.comparisonValue === undefined
                    ? null
                    : valueFormatter(item.comparisonValue);
                const secondaryComparisonPercentage =
                  secondaryComparisonPercentages.at(itemIndex);
                const formattedSecondaryComparisonValue =
                  item.secondaryComparisonValue === null ||
                  item.secondaryComparisonValue === undefined
                    ? null
                    : valueFormatter(item.secondaryComparisonValue);
                const comparisonOverlapsValueLabel =
                  comparisonPercentage !== null &&
                  comparisonPercentage !== undefined &&
                  comparisonPercentage >= percentage - 1 &&
                  comparisonPercentage <= percentage + 9;
                const placeValueInsideBar =
                  normalizedValue !== null &&
                  percentage >= 10 &&
                  (percentage >= 92 || comparisonOverlapsValueLabel);
                const comparisonOverlapsSecondaryLabel =
                  secondaryComparisonPercentage !== null &&
                  secondaryComparisonPercentage !== undefined &&
                  secondaryComparisonPercentage >= secondaryPercentage - 1 &&
                  secondaryComparisonPercentage <= secondaryPercentage + 9;
                const placeSecondaryValueInsideBar =
                  normalizedSecondaryValue !== null &&
                  secondaryPercentage >= 10 &&
                  (secondaryPercentage >= 92 ||
                    comparisonOverlapsSecondaryLabel);
                const isActive = activeItemId === item.id;
                const isDimmed = hasActiveItem && !isActive;

                return (
                  <div
                    key={`${item.id}:${item.value ?? "null"}:${item.secondaryValue ?? "undefined"}:${item.comparisonValue ?? "null"}:${item.secondaryComparisonValue ?? "undefined"}`}
                    className="flex min-w-0 flex-col"
                    role="listitem"
                    aria-label={`${item.label}: ${formattedValue}${hasSecondarySeries ? `, ${secondaryLabel}: ${formattedSecondaryValue}` : ""}${formattedComparisonValue ? `, ${comparisonLabel}: ${formattedComparisonValue}` : ""}${formattedSecondaryComparisonValue ? `, ${secondaryComparisonLabel}: ${formattedSecondaryComparisonValue}` : ""}`}
                  >
                    <div className="relative min-h-0 flex-1">
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-y-0 left-1/2 w-[calc(100%-8px)] -translate-x-1/2 rounded-t-lg bg-blue-50/70 opacity-0 transition-opacity duration-200",
                          isActive && "opacity-100",
                        )}
                        aria-hidden="true"
                      />
                      <span
                        className={cn(
                          "estude-chart-motion pointer-events-none absolute z-40 text-center text-[10px] font-bold",
                          placeValueInsideBar
                            ? "text-white"
                            : "text-slate-600",
                        )}
                        style={{
                          left: hasSecondarySeries ? "9%" : 0,
                          right: hasSecondarySeries ? "41%" : 0,
                          bottom: placeValueInsideBar
                            ? `calc(${percentage}% - 18px)`
                            : `calc(${percentage}% + 4px)`,
                          animation: `estude-chart-label-fade 350ms ease-out ${500 + itemIndex * 45}ms both`,
                          filter: isDimmed ? "opacity(0.35)" : undefined,
                          transition: "filter 200ms ease",
                        }}
                      >
                        <span
                          className={cn(
                            placeValueInsideBar &&
                              "inline-flex rounded px-1 py-px shadow-sm",
                          )}
                          style={
                            placeValueInsideBar
                              ? {
                                  backgroundColor:
                                    item.color ?? DEFAULT_BAR_COLOR,
                                }
                              : undefined
                          }
                        >
                          {formattedValue}
                        </span>
                      </span>
                      {hasSecondarySeries ? (
                        <span
                          className={cn(
                            "estude-chart-motion pointer-events-none absolute left-[41%] right-[9%] z-40 text-center text-[10px] font-bold",
                            placeSecondaryValueInsideBar
                              ? "text-white"
                              : "text-slate-600",
                          )}
                          style={{
                            bottom: placeSecondaryValueInsideBar
                              ? `calc(${secondaryPercentage}% - 18px)`
                              : `calc(${secondaryPercentage}% + 4px)`,
                            animation: `estude-chart-label-fade 350ms ease-out ${540 + itemIndex * 45}ms both`,
                            filter: isDimmed ? "opacity(0.35)" : undefined,
                            transition: "filter 200ms ease",
                          }}
                        >
                          <span
                            className={cn(
                              placeSecondaryValueInsideBar &&
                                "inline-flex rounded px-1 py-px shadow-sm",
                            )}
                            style={
                              placeSecondaryValueInsideBar
                                ? { backgroundColor: secondaryColor }
                                : undefined
                            }
                          >
                            {formattedSecondaryValue}
                          </span>
                        </span>
                      ) : null}
                      {normalizedValue === null ? (
                        <span
                          className="absolute bottom-0 border-t-2 border-dashed border-slate-200"
                          style={{
                            left: hasSecondarySeries ? "19%" : "8px",
                            right: hasSecondarySeries ? "51%" : "8px",
                          }}
                        />
                      ) : (
                        <span
                          className="estude-chart-motion peer absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-md transition-[filter,width] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                          style={{
                            left: hasSecondarySeries ? "34%" : "50%",
                            width: hasSecondarySeries
                              ? isActive
                                ? "min(30px, 34%)"
                                : "min(26px, 30%)"
                              : isActive
                                ? "min(38px, 82%)"
                                : "min(32px, 70%)",
                            height: `${Math.max(percentage, 2)}%`,
                            backgroundColor: item.color ?? DEFAULT_BAR_COLOR,
                            animation: `estude-chart-bar-grow 650ms cubic-bezier(0.22, 1, 0.36, 1) ${itemIndex * 45}ms both`,
                            filter: isDimmed
                              ? "saturate(0.45) opacity(0.35)"
                              : isActive
                                ? "brightness(1.08) drop-shadow(0 4px 5px rgb(37 99 235 / 0.25))"
                                : undefined,
                          }}
                          tabIndex={0}
                          role="img"
                          aria-label={`${item.label}. ${valueLabel}: ${formattedValue}${hasSecondarySeries ? `. ${secondaryLabel}: ${formattedSecondaryValue}` : ""}${formattedComparisonValue ? `. ${comparisonLabel}: ${formattedComparisonValue}` : ""}`}
                          onMouseEnter={() => setActiveItemId(item.id)}
                          onMouseLeave={() => setActiveItemId(null)}
                          onFocus={() => setActiveItemId(item.id)}
                          onBlur={() => setActiveItemId(null)}
                        />
                      )}
                      {hasSecondarySeries ? (
                        normalizedSecondaryValue === null ? (
                          <span className="absolute bottom-0 left-[51%] right-[19%] border-t-2 border-dashed border-violet-200" />
                        ) : (
                          <span
                            className="estude-chart-motion peer absolute bottom-0 left-[66%] -translate-x-1/2 rounded-t-md transition-[filter,width] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                            style={{
                              width: isActive
                                ? "min(30px, 34%)"
                                : "min(26px, 30%)",
                              height: `${Math.max(secondaryPercentage, 2)}%`,
                              backgroundColor: secondaryColor,
                              animation: `estude-chart-bar-grow 650ms cubic-bezier(0.22, 1, 0.36, 1) ${80 + itemIndex * 45}ms both`,
                              filter: isDimmed
                                ? "saturate(0.45) opacity(0.35)"
                                : isActive
                                  ? "brightness(1.08) drop-shadow(0 4px 5px rgb(124 58 237 / 0.25))"
                                  : undefined,
                            }}
                            tabIndex={0}
                            role="img"
                            aria-label={`${item.label}. ${secondaryLabel}: ${formattedSecondaryValue}`}
                            onMouseEnter={() => setActiveItemId(item.id)}
                            onMouseLeave={() => setActiveItemId(null)}
                            onFocus={() => setActiveItemId(item.id)}
                            onBlur={() => setActiveItemId(null)}
                          />
                        )
                      ) : null}
                      {comparisonPercentage !== null &&
                      comparisonPercentage !== undefined ? (
                        <span
                          className="estude-chart-motion pointer-events-none absolute left-1/2 z-30 size-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                          style={{
                            left: hasSecondarySeries ? "34%" : "50%",
                            bottom: `${comparisonPercentage}%`,
                            backgroundColor: comparisonColor,
                            animation: `estude-chart-point-pop 300ms cubic-bezier(0.22, 1, 0.36, 1) ${420 + itemIndex * 45}ms both`,
                            filter: isDimmed
                              ? "opacity(0.35)"
                              : isActive
                                ? "drop-shadow(0 2px 3px rgb(245 158 11 / 0.45))"
                                : undefined,
                            transition: "filter 200ms ease",
                          }}
                          title={`${comparisonLabel}: ${formattedComparisonValue}`}
                          aria-hidden="true"
                        />
                      ) : null}
                      {secondaryComparisonPercentage !== null &&
                      secondaryComparisonPercentage !== undefined ? (
                        <span
                          className="estude-chart-motion pointer-events-none absolute left-[66%] z-30 size-3 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-sm"
                          style={{
                            bottom: `${secondaryComparisonPercentage}%`,
                            backgroundColor: secondaryComparisonColor,
                            animation: `estude-chart-point-pop 300ms cubic-bezier(0.22, 1, 0.36, 1) ${460 + itemIndex * 45}ms both`,
                            filter: isDimmed
                              ? "opacity(0.35)"
                              : isActive
                                ? "drop-shadow(0 2px 3px rgb(20 184 166 / 0.45))"
                                : undefined,
                            transition: "filter 200ms ease",
                          }}
                          title={`${secondaryComparisonLabel}: ${formattedSecondaryComparisonValue}`}
                          aria-hidden="true"
                        />
                      ) : null}
                      {normalizedValue !== null ||
                      normalizedSecondaryValue !== null ? (
                        <div
                          className={cn(
                            "pointer-events-none invisible absolute top-2 z-50 w-max min-w-44 max-w-56 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] leading-4 text-slate-700 opacity-0 shadow-lg transition-[opacity,visibility] duration-150 peer-hover:visible peer-hover:opacity-100 peer-focus-visible:visible peer-focus-visible:opacity-100",
                            itemIndex === 0
                              ? "left-0"
                              : itemIndex === visibleItems.length - 1
                                ? "right-0"
                                : "left-1/2 -translate-x-1/2",
                          )}
                          role="tooltip"
                        >
                          <p className="mb-1 font-bold text-slate-900">
                            {item.label}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor:
                                  item.color ?? DEFAULT_BAR_COLOR,
                              }}
                            />
                            <span>
                              {valueLabel}: {formattedValue}
                            </span>
                          </p>
                          {hasSecondarySeries ? (
                            <p className="flex items-center gap-1.5">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: secondaryColor }}
                              />
                              <span>
                                {secondaryLabel}: {formattedSecondaryValue}
                              </span>
                            </p>
                          ) : null}
                          {formattedComparisonValue ? (
                            <p className="flex items-center gap-1.5">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: comparisonColor }}
                              />
                              <span>
                                {comparisonLabel}: {formattedComparisonValue}
                              </span>
                            </p>
                          ) : null}
                          {formattedSecondaryComparisonValue ? (
                            <p className="flex items-center gap-1.5">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    secondaryComparisonColor,
                                }}
                              />
                              <span>
                                {secondaryComparisonLabel}:{" "}
                                {formattedSecondaryComparisonValue}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span className="flex h-8 items-center justify-center truncate px-0.5 text-center text-[10px] font-semibold text-slate-500">
                      {item.shortLabel ?? item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
