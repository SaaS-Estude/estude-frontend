/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuestionImageViewer({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(1);
  return <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur"><figcaption className="text-xs font-bold text-slate-500">Ảnh câu hỏi · {Math.round(zoom * 100)}%</figcaption><div className="flex gap-1"><Button size="sm" variant="ghost" className="!size-10 !p-0" aria-label="Thu nhỏ ảnh" disabled={zoom <= 1} onClick={() => setZoom((value) => Math.max(1, value - 0.25))}><Minus className="size-4" /></Button><Button size="sm" variant="ghost" className="!size-10 !p-0" aria-label="Đặt lại kích thước" onClick={() => setZoom(1)}><RotateCcw className="size-4" /></Button><Button size="sm" variant="ghost" className="!size-10 !p-0" aria-label="Phóng to ảnh" disabled={zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}><Plus className="size-4" /></Button></div></div><div className="max-h-[62vh] overflow-auto overscroll-contain p-3 touch-pan-x touch-pan-y"><div style={{ width: `${zoom * 100}%` }} className="transition-[width] duration-150"><img src={src} alt={alt} draggable={false} className="h-auto w-full max-w-none select-none rounded-lg bg-white object-contain shadow-sm" /></div></div></figure>;
}
