export type UserRole = "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
export type UserStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "LOCKED";

export interface AssignedClassSummary {
  id: string;
  code: string;
  name: string;
}

export interface User {
  id: string;
  fullName: string;
  accountName: string;
  keyword?: string | null;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  gender?: "M" | "F" | null;
  birthday?: string | null;
  provinceCity?: string | null;
  specificAddress?: string | null;
  cccd?: string | null;
  degree?: string | null;
  issueDate?: string | null;
  joinDate?: string | null;
  course?: string | null;
  grade?: string | null;
  assignedClass?: AssignedClassSummary | null;
  assignedClasses?: AssignedClassSummary[];
  createdAt: string;
  updatedAt: string;
  updatedById?: string | null;
  updatedByAccountName?: string | null;
  updatedByAt?: string | null;
  updatedByFullName?: string | null;
  updatedByAvatarUrl?: string | null;
  requiresFirstLoginSetup?: boolean;
  emailVerifiedAt?: string | null;
  lastLoginAt: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: User;
}

export interface AccessTokenResponse {
  accessToken: string;
}

export interface LoginSessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  createdAt: string;
  current: boolean;
}

export interface LoginPayload {
  accountName: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  fullName: string;
  confirmPassword: string;
}

export interface UpdateProfilePayload {
  email: string | null;
  phoneNumber: string | null;
}

export interface ApiEnvelope<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export interface ApiErrorEnvelope {
  success: false;
  statusCode: number;
  message: string;
  errors?: string[];
  path: string;
  timestamp: string;
}

export interface OtpChallenge {
  challengeId: string;
  expiresIn: number;
  retryAfter: number;
}
export interface ResetPasswordPayload {
  challengeId: string;
  code: string;
  newPassword: string;
  confirmNewPassword: string;
}
