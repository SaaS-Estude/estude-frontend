import type { User } from "@/types/auth";

export interface UsersPage {
  items: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ParentStudentLink {
  id: string;
  parent: User;
  student: User;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED";
  relationshipType: "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER";
  note: string | null;
  approvedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ParentStudentLinksPage {
  items: ParentStudentLink[];
  meta: UsersPage["meta"];
}

export interface ImportUserError {
  row: number;
  accountName?: string;
  message: string;
}

export interface ImportUsersResult {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  errors: ImportUserError[];
}

export interface DefaultPasswordSettings {
  teacherConfigured: boolean;
  studentConfigured: boolean;
  parentConfigured: boolean;
  updatedAt: string | null;
}

export interface ParentLinkSettings {
  requireApproval: boolean;
  updatedAt: string | null;
}
