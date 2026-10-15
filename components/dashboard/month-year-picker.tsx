"use client";

import { useRef, useState } from "react";

export function MonthYearPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(month.slice(0, 4));
  const [number, setNumber] = useState(Number(month.slice(5)));
  const trigger = useRef<HTMLButtonElement>(null);
  const validYear = /^\d{4}$/.test(year) && Number(year) >= 1000;
  function close() { setOpen(false); trigger.current?.focus(); }
  return <div className="relative">
    <button ref={trigger} type="button" aria-label="Chọn tháng và năm" aria-expanded={open} aria-haspopup="dialog" onClick={() => {
      if (open) close();
      else { setYear(month.slice(0, 4)); setNumber(Number(month.slice(5))); setOpen(true); }
    }} title={`Tháng ${Number(month.slice(5))}, năm ${month.slice(0, 4)}`} className="flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
      Tháng {Number(month.slice(5))}
    </button>
    {open ? <>
      <button type="button" aria-label="Đóng chọn tháng và năm" onClick={close} className="fixed inset-0 z-20 cursor-default" />
      <form role="dialog" aria-label="Chọn tháng và năm" onKeyDown={(event) => { if (event.key === 'Escape') close(); }} onSubmit={(event) => {
        event.preventDefault();
        if (validYear) { onChange(`${year}-${String(number).padStart(2, '0')}`); close(); }
      }} className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl">
        <label htmlFor="calendar-year" className="text-xs font-semibold text-slate-600">Năm</label>
        <input id="calendar-year" aria-label="Năm" type="text" inputMode="numeric" autoFocus maxLength={4} value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, ''))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-500" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <button key={value} type="button" aria-pressed={value === number} onClick={() => setNumber(value)} className={`min-h-10 rounded-lg text-xs font-semibold ${value === number ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>Tháng {value}</button>)}
        </div>
        {!validYear ? <p className="mt-2 text-xs text-rose-600">Nhập năm gồm 4 chữ số, từ 1000 đến 9999.</p> : null}
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={close} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-slate-600">Hủy</button><button type="submit" disabled={!validYear} className="min-h-10 rounded-lg bg-brand-600 px-4 text-xs font-bold text-white disabled:opacity-40">Xem lịch</button></div>
      </form>
    </> : null}
  </div>;
}
