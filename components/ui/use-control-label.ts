"use client";
import { useEffect, useState, type RefObject } from "react";

export function useControlLabel(ref: RefObject<HTMLSelectElement | HTMLInputElement | null>, explicit?: string) {
  const [inherited, setInherited] = useState("");
  useEffect(() => {
    const field = ref.current;
    if (!field || explicit) return;
    const container = field.closest("[data-custom-control]");
    const parent = container?.closest("label");
    if (!parent) return;
    const copy = parent.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("[data-custom-control]").forEach((node) => node.remove());
    setInherited(copy.textContent?.replace(/\s+/g, " ").trim() ?? "");
  }, [ref, explicit]);
  return explicit || inherited || undefined;
}
