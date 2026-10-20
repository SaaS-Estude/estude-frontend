"use client";

import { forwardRef, useId, useImperativeHandle, useRef, useState, type InputHTMLAttributes } from "react";
import { DateRangePicker, DateTimePicker } from "./date-range-picker";
import { CustomSelect } from "./custom-select";
import { useControlLabel } from "./use-control-label";

export interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  type?: "date" | "datetime-local" | "time";
  label?: string;
  hint?: string;
  error?: string;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { type = "date", label, hint, error, id, value, defaultValue, className, onChange, onInvalid, ...props }, ref,
) {
  const native = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLSpanElement>(null);
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const [local, setLocal] = useState(String(defaultValue ?? ""));
  const [invalid, setInvalid] = useState("");
  const current = value === undefined ? local : String(value);
  const inheritedLabel = useControlLabel(native, props["aria-label"] ?? label);
  useImperativeHandle(ref, () => native.current!);

  function change(next: string) {
    if (!native.current) return;
    // Bypass React's value tracker so the existing onChange receives a real event.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(native.current, next);
    native.current.dispatchEvent(new Event("input", { bubbles: true }));
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const disabled = props.disabled || props.readOnly;
  const pickerProps = { id: controlId, disabled, ariaLabel: inheritedLabel, min: props.min === undefined ? undefined : String(props.min), max: props.max === undefined ? undefined : String(props.max), buttonClassName: className };
  return <span data-custom-control ref={container} className="relative block min-w-0">
    {label && <label htmlFor={controlId} className="mb-2 block text-sm font-bold text-slate-700">{label}</label>}
    <input {...props} ref={native} type={type} value={value} defaultValue={defaultValue} tabIndex={-1} aria-hidden="true" className="pointer-events-none sr-only"
      onChange={(event) => { setLocal(event.target.value); setInvalid(""); onChange?.(event); }}
      onInvalid={(event) => { event.preventDefault(); setInvalid(event.currentTarget.validationMessage); container.current?.querySelector<HTMLButtonElement>("button")?.focus(); onInvalid?.(event); }} />
    {type === "date" ? <DateRangePicker {...pickerProps} from={current} to={current} singleDate onChange={(range) => change(range.from)} />
      : type === "datetime-local" ? <DateTimePicker {...pickerProps} value={current} onChange={change} />
      : <span className="flex items-center gap-2" role="group" aria-label={inheritedLabel ?? "Chọn giờ"}>
        <CustomSelect id={controlId} className="min-w-0 flex-1" ariaLabel={`${inheritedLabel ?? "Thời gian"} · Giờ`} disabled={disabled} value={current.slice(0, 2)} options={Array.from({ length: 24 }, (_, n) => ({ value: String(n).padStart(2, "0"), label: String(n).padStart(2, "0") }))} onValueChange={(hour) => change(`${hour}:${current.slice(3, 5) || "00"}`)} />
        <span aria-hidden="true">:</span>
        <CustomSelect className="min-w-0 flex-1" ariaLabel={`${inheritedLabel ?? "Thời gian"} · Phút`} disabled={disabled} value={current.slice(3, 5)} options={Array.from({ length: 60 }, (_, n) => ({ value: String(n).padStart(2, "0"), label: String(n).padStart(2, "0") }))} onValueChange={(minute) => change(`${current.slice(0, 2) || "00"}:${minute}`)} />
      </span>}
    {!props.required && !disabled && current && <button type="button" className="mt-1 text-xs text-slate-500 hover:text-brand-700" onClick={() => change("")}>Xóa ngày giờ</button>}
    {(hint || error || invalid) && <span className={`mt-1.5 block text-xs ${error || invalid ? "text-rose-600" : "text-slate-400"}`}>{error || invalid || hint}</span>}
  </span>;
});
