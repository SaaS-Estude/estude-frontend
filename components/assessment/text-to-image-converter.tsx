/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eye, ImagePlus, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TextToImageConverter({ text, existingImageUrl, onApply, onRemove }: { text: string; existingImageUrl?: string; onApply: (image: Blob, previewUrl: string) => void; onRemove: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState(existingImageUrl ?? "");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [rendering, setRendering] = useState(false);
  const [applied, setApplied] = useState(Boolean(existingImageUrl));
  const [error, setError] = useState("");

  useEffect(() => { if (existingImageUrl) setPreviewUrl(existingImageUrl); }, [existingImageUrl]);
  useEffect(() => () => { if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function renderImage() {
    if (!text.trim()) { setError("Hãy nhập nội dung câu hỏi trước khi tạo ảnh."); return; }
    setRendering(true);
    setError("");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) { setError("Trình duyệt không hỗ trợ tạo ảnh."); setRendering(false); return; }
    const width = 1200;
    const horizontalPadding = 80;
    const lineHeight = 52;
    context.font = "32px Arial, sans-serif";
    const lines: string[] = [];
    text.trim().split(/\r?\n/).forEach((paragraph) => {
      if (!paragraph.trim()) { lines.push(""); return; }
      let line = "";
      paragraph.split(/\s+/).forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (context.measureText(candidate).width > width - horizontalPadding * 2 && line) { lines.push(line); line = word; } else line = candidate;
      });
      if (line) lines.push(line);
    });
    canvas.width = width;
    canvas.height = Math.max(420, 170 + lines.length * lineHeight + 80);
    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#1d4ed8";
    context.fillRect(0, 0, 14, canvas.height);
    context.font = "700 24px Arial, sans-serif";
    context.fillStyle = "#2563eb";
    context.fillText("EStude  •  CÂU HỎI", horizontalPadding, 78);
    context.strokeStyle = "#dbeafe";
    context.beginPath(); context.moveTo(horizontalPadding, 112); context.lineTo(width - horizontalPadding, 112); context.stroke();
    context.font = "32px Arial, sans-serif";
    context.fillStyle = "#0f172a";
    lines.forEach((line, index) => context.fillText(line, horizontalPadding, 172 + index * lineHeight));
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) { setError("Không thể kết xuất ảnh. Vui lòng thử lại."); setRendering(false); return; }
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      setBlob(nextBlob);
      setPreviewUrl(URL.createObjectURL(nextBlob));
      setApplied(false);
      setRendering(false);
    }, "image/png");
  }

  function apply() {
    if (!blob) return;
    onApply(blob, previewUrl);
    setApplied(true);
  }

  return <section className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-extrabold text-slate-900"><ImagePlus className="size-5 text-violet-700" /> Chuyển nội dung thành ảnh</div><p className="mt-1 text-xs leading-5 text-slate-500">Ảnh giúp hiển thị ổn định và hạn chế sao chép nội dung gốc trong giao diện học sinh.</p></div><Button variant="outline" disabled={rendering || !text.trim()} onClick={() => void renderImage()}>{rendering ? <LoaderCircle className="size-4 animate-spin" /> : previewUrl ? <RefreshCw className="size-4" /> : <ImagePlus className="size-4" />} {rendering ? "Đang kết xuất..." : previewUrl ? "Tạo lại" : "Tạo ảnh"}</Button></div>{error ? <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}{previewUrl ? <div className="mt-4"><div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3"><img src={previewUrl} alt="Bản xem trước ảnh câu hỏi" className="mx-auto h-auto max-h-[520px] max-w-full rounded-lg bg-white object-contain shadow-sm" /></div><div className="mt-3 flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => { setPreviewUrl(""); setBlob(null); setApplied(false); onRemove(); }}><Trash2 className="size-4" /> Gỡ ảnh</Button><Button disabled={!blob || applied} onClick={apply}>{applied ? <Check className="size-4" /> : <Eye className="size-4" />} {applied ? "Đã áp dụng" : "Áp dụng ảnh"}</Button></div></div> : null}<canvas ref={canvasRef} className="hidden" aria-hidden="true" /></section>;
}
