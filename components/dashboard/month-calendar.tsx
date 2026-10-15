"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarMonth, shiftCalendarMonth } from "@/lib/calendar-view";
import { MonthYearPicker } from "@/components/dashboard/month-year-picker";

export function MonthCalendar({ month, today, selectedDay, onSelectDay, onChangeMonth, renderDay, toolbar }: {
  month: string;
  today: string;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  onChangeMonth: (month: string) => void;
  renderDay: (day: string) => ReactNode;
  toolbar?: ReactNode;
}) {
  const { weeks } = calendarMonth(month);
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{toolbar}</div>
      <div className="ml-auto flex shrink-0 items-center">
        <button type="button" aria-label="Tháng trước" onClick={() => onChangeMonth(shiftCalendarMonth(month, -1))} className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"><ChevronLeft className="size-4" /></button>
        <MonthYearPicker month={month} onChange={onChangeMonth} />
        <button type="button" aria-label="Tháng sau" onClick={() => onChangeMonth(shiftCalendarMonth(month, 1))} className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"><ChevronRight className="size-4" /></button>
      </div>
    </header>
    <div className="max-h-[720px] overflow-auto border-t border-slate-100">
      <div className="min-w-[840px]">
        <div className="sticky top-0 z-10 grid grid-cols-7 bg-slate-50">
          {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => <div key={label} className="border-b border-r border-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 last:border-r-0">{label}</div>)}
        </div>
        {weeks.map((week, index) => <div key={index} className="grid grid-cols-7">
          {week.map((day, column) => <div key={day ?? `blank-${column}`} className={`min-h-[104px] space-y-1 border-b border-r border-slate-100 p-1.5 last:border-r-0 ${day === selectedDay ? 'bg-slate-100' : day ? 'bg-white' : 'bg-slate-50/50'}`}>
            {day ? <><button type="button" aria-label={`${day}${day === today ? ', hôm nay' : ''}`} aria-pressed={day === selectedDay} onClick={() => onSelectDay(day)} className={`grid size-8 place-items-center rounded-full text-xs font-semibold ${day === today ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-200'}`}>{Number(day.slice(-2))}</button>{renderDay(day)}</> : null}
          </div>)}
        </div>)}
      </div>
    </div>
  </section>;
}
