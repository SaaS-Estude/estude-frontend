import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function getVisiblePages(page: number, totalPages: number): number[] {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const windowStart = Math.min(Math.max(page - 1, 1), totalPages - 2);
  const visiblePages = new Set<number>([1, totalPages]);
  for (let current = windowStart; current < windowStart + 3; current += 1) {
    visiblePages.add(current);
  }
  return [...visiblePages].sort((left, right) => left - right);
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  const currentPage = Math.min(Math.max(page, 1), safeTotalPages);
  const pages = getVisiblePages(currentPage, safeTotalPages);

  return (
    <nav className="flex items-center gap-1" aria-label="Phân trang">
      <Button
        variant="outline"
        size="sm"
        className="!h-8 !w-8 !rounded-lg !shadow-none px-0 focus:!ring-0"
        disabled={currentPage <= 1}
        onClick={() => onChange(currentPage - 1)}
        aria-label="Trang trước"
      >
        <ChevronLeft className="!h-5 !w-5 !shrink-0" strokeWidth={2.5} />
      </Button>
      {pages.map((item, index) => {
        const previous = pages[index - 1];
        return (
          <span key={item} className="contents">
            {previous && item - previous > 1 ? (
              <span className="px-1 text-slate-400">…</span>
            ) : null}
            <Button
              variant={item === currentPage ? "primary" : "outline"}
              size="sm"
              className="!h-8 !w-8 !rounded-lg !shadow-none px-0 focus:!ring-0"
              onClick={() => onChange(item)}
              aria-current={item === currentPage ? "page" : undefined}
            >
              {item}
            </Button>
          </span>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        className="!h-8 !w-8 !rounded-lg !shadow-none px-0 focus:!ring-0"
        disabled={currentPage >= safeTotalPages}
        onClick={() => onChange(currentPage + 1)}
        aria-label="Trang sau"
      >
        <ChevronRight className="!h-5 !w-5 !shrink-0" strokeWidth={2.5} />
      </Button>
    </nav>
  );
}
