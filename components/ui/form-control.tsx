"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check, ChevronDown, Eye, EyeOff, LoaderCircle, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { normalizeSearchKeyword } from "@/lib/search-keyword";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  label?: string;
  hint?: string;
  error?: string;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    icon: Icon,
    label,
    hint,
    error,
    showPasswordToggle = false,
    id,
    type,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const canTogglePassword = showPasswordToggle && type === "password";
  const control = (
    <span className="relative block">
      {Icon ? (
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      ) : null}
      <input
        id={inputId}
        ref={ref}
        type={canTogglePassword && passwordVisible ? "text" : type}
        className={cn(
          "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          Icon && "pl-9",
          canTogglePassword && "pr-11",
          error && "border-rose-300 focus:border-rose-400 focus:ring-rose-100",
          className,
        )}
        {...props}
      />
      {canTogglePassword ? (
        <button
          type="button"
          aria-label={passwordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          title={passwordVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          onClick={() => setPasswordVisible((current) => !current)}
          className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          {passwordVisible ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </button>
      ) : null}
    </span>
  );

  if (!label && !hint && !error) return control;
  return (
    <div className="block">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-bold text-slate-700"
        >
          {label}
        </label>
      ) : null}
      {control}
      {error || hint ? (
        <span
          className={cn(
            "mt-1.5 block text-xs leading-5",
            error ? "text-rose-600" : "text-slate-400",
          )}
        >
          {error ?? hint}
        </span>
      ) : null}
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, label, hint, error, children, ...props }, ref) {
    const control = (
      <span className="relative block">
        <select
          ref={ref}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            error &&
              "border-rose-300 focus:border-rose-400 focus:ring-rose-100",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      </span>
    );
    if (!label && !hint && !error) return control;
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-700">
          {label}
        </span>
        {control}
        {error || hint ? (
          <span
            className={cn(
              "mt-1.5 block text-xs leading-5",
              error ? "text-rose-600" : "text-slate-400",
            )}
          >
            {error ?? hint}
          </span>
        ) : null}
      </label>
    );
  },
);

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, label, hint, error, ...props }, ref) {
    const control = (
      <textarea
        ref={ref}
        className={cn(
          "min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          error && "border-rose-300 focus:border-rose-400 focus:ring-rose-100",
          className,
        )}
        {...props}
      />
    );

    if (!label && !hint && !error) return control;
    return (
      <label className="block">
        {label ? (
          <span className="mb-2 block text-sm font-bold text-slate-700">
            {label}
          </span>
        ) : null}
        {control}
        {error || hint ? (
          <span
            className={cn(
              "mt-1.5 block text-xs leading-5",
              error ? "text-rose-600" : "text-slate-400",
            )}
          >
            {error ?? hint}
          </span>
        ) : null}
      </label>
    );
  },
);

export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  placement?: "top" | "bottom";
  disabled?: boolean;
  ariaLabel?: string;
  showSelectedIndicator?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onSearchChange?: (search: string) => void;
  isSearching?: boolean;
}

export function CustomSelect({
  value,
  options,
  onValueChange,
  placeholder = "Chọn giá trị",
  label,
  className,
  buttonClassName,
  menuClassName,
  optionClassName,
  placement = "bottom",
  disabled = false,
  ariaLabel,
  showSelectedIndicator = true,
  searchable = false,
  searchPlaceholder = "Tìm kiếm...",
  emptyMessage = "Không tìm thấy kết quả",
  onSearchChange,
  isSearching = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const normalizedSearch = normalizeSearchKeyword(search);
  const usesApiSearch = searchable && Boolean(onSearchChange);
  const filteredOptions = searchable && !usesApiSearch && normalizedSearch
    ? options.filter((option) =>
        normalizeSearchKeyword(option.label, option.value).includes(normalizedSearch),
      )
    : options;

  function clearPendingSearch() {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = null;
  }

  function handleSearchChange(nextSearch: string) {
    setSearch(nextSearch);
    if (!onSearchChange) return;
    clearPendingSearch();
    searchTimerRef.current = setTimeout(() => onSearchChange(nextSearch), 300);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSearch("");
        clearPendingSearch();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setSearch("");
        clearPendingSearch();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      clearPendingSearch();
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label ? (
        <span
          id={labelId}
          className="mb-2 block text-sm font-bold text-slate-700"
        >
          {label}
        </span>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          setSearch("");
          clearPendingSearch();
          if (nextOpen) onSearchChange?.("");
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          open && "border-brand-400 ring-4 ring-blue-100",
          buttonClassName,
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-slate-400")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180 text-brand-600",
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 max-h-64 w-full min-w-max overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15",
            placement === "bottom"
              ? "left-0 top-full mt-2"
              : "bottom-full left-0 mb-2",
            menuClassName,
          )}
        >
          {searchable ? (
            <div className="sticky top-0 z-10 bg-white p-1 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  autoFocus
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          ) : null}

          {isSearching ? (
            <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-400">
              <LoaderCircle className="size-4 animate-spin" /> Đang tìm kiếm...
            </p>
          ) : null}

          {!isSearching && filteredOptions.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              {emptyMessage}
            </p>
          ) : null}

          {!isSearching ? filteredOptions.map((option) => {
            const selected = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                key={option.value}
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                  setSearch("");
                  clearPendingSearch();
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left text-sm transition",
                  selected
                    ? "bg-brand-600 font-bold text-white"
                    : "text-slate-700 hover:bg-blue-50 hover:text-brand-700",
                  optionClassName,
                )}
              >
                <span>{option.label}</span>
                {selected && showSelectedIndicator ? (
                  <Check className="size-4 shrink-0" />
                ) : null}
              </button>
            );
          }) : null}
        </div>
      ) : null}
    </div>
  );
}
