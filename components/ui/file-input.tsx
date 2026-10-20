"use client";
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// File selection must retain the browser file picker and its FileList/ref API.
export const FileInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function FileInput({ className, ...props }, ref) {
  return <input {...props} ref={ref} type="file" className={cn(
    "block max-w-full text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
    className,
  )} />;
});
