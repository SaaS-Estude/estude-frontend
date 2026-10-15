"use client";

import { ChevronDown, ChevronRight, FileQuestion, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { QuestionFolder } from "@/types/assessment";

export type FolderSelection = "all" | "unfiled" | string;

export function folderDescendantIds(folders: QuestionFolder[], id: string): Set<string> {
  const result = new Set<string>([id]);
  for (const folder of folders.filter((item) => item.parentId === id)) {
    for (const childId of folderDescendantIds(folders, folder.id)) result.add(childId);
  }
  return result;
}

export function QuestionFolderTree({
  folders,
  selected,
  counts,
  canCreate,
  canUpdate,
  canDelete,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: QuestionFolder[];
  selected: FolderSelection;
  counts: Record<string, number>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onSelect: (id: FolderSelection) => void;
  onCreate: (parentId: string | null) => void;
  onRename: (folder: QuestionFolder) => void;
  onDelete: (folder: QuestionFolder) => void;
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const rowClass = (active: boolean) =>
    `flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${active ? "bg-blue-50 font-bold text-brand-700" : "text-slate-700 hover:bg-slate-50"}`;

  function renderChildren(parentId: string | null): ReactNode {
    return folders
      .filter((folder) => folder.parentId === parentId)
      .map((folder) => {
        const hasChildren = folders.some((item) => item.parentId === folder.id);
        const isCollapsed = collapsed.includes(folder.id);
        const descendantIds = folderDescendantIds(folders, folder.id);
        const count = [...descendantIds].reduce((sum, id) => sum + (counts[id] ?? 0), 0);
        return (
          <div key={folder.id}>
            <div className="group flex items-center gap-0.5" style={{ paddingLeft: (folder.depth - 1) * 12 }}>
              <button
                type="button"
                aria-label={isCollapsed ? `Mở ${folder.name}` : `Thu gọn ${folder.name}`}
                className="flex size-6 shrink-0 items-center justify-center text-slate-400"
                onClick={() => setCollapsed((ids) => isCollapsed ? ids.filter((id) => id !== folder.id) : [...ids, folder.id])}
              >
                {hasChildren ? isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" /> : null}
              </button>
              <button type="button" className={rowClass(selected === folder.id)} onClick={() => onSelect(folder.id)} title={folder.name}>
                <Folder className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                <span className="text-xs font-normal text-slate-400">{count}</span>
              </button>
              <div className="hidden items-center group-hover:flex group-focus-within:flex">
                {canCreate && folder.depth < 3 ? <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Tạo thư mục con" aria-label={`Tạo thư mục con trong ${folder.name}`} onClick={() => onCreate(folder.id)}><FolderPlus className="size-3.5" /></button> : null}
                {canUpdate ? <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Đổi tên" aria-label={`Đổi tên ${folder.name}`} onClick={() => onRename(folder)}><Pencil className="size-3.5" /></button> : null}
                {canDelete ? <button type="button" className="rounded p-1 text-rose-500 hover:bg-rose-50" title="Xóa thư mục trống" aria-label={`Xóa ${folder.name}`} onClick={() => onDelete(folder)}><Trash2 className="size-3.5" /></button> : null}
              </div>
            </div>
            {!isCollapsed ? renderChildren(folder.id) : null}
          </div>
        );
      });
  }

  return (
    <nav aria-label="Cây thư mục câu hỏi" className="space-y-1">
      <button type="button" className={rowClass(selected === "all")} onClick={() => onSelect("all")}>
        <FileQuestion className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Tất cả câu hỏi</span>
        <span className="text-xs font-normal text-slate-400">{counts.all ?? 0}</span>
      </button>
      <button type="button" className={rowClass(selected === "unfiled")} onClick={() => onSelect("unfiled")}>
        <Folder className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Chưa xếp thư mục</span>
        <span className="text-xs font-normal text-slate-400">{counts.unfiled ?? 0}</span>
      </button>
      <div className="border-t border-slate-100 pt-2">{renderChildren(null)}</div>
    </nav>
  );
}
