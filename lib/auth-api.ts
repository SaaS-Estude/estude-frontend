import type {
  OtpChallenge,
  ResetPasswordPayload,
  AccessTokenResponse,
  ApiEnvelope,
  ApiErrorEnvelope,
  AuthSession,
  LoginPayload,
  LoginSessionInfo,
  RegisterPayload,
  UpdateProfilePayload,
  User,
} from "@/types/auth";
import { getCurrentPortal } from "@/lib/portal";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1"
).replace(/\/$/, "");

let accessToken: string | null = null;
const accessTokenListeners = new Set<(token: string | null) => void>();

function setAccessToken(token: string | null): void {
  if (accessToken === token) return;
  accessToken = token;
  for (const listener of accessTokenListeners) listener(token);
}

export function subscribeAccessToken(
  listener: (token: string | null) => void,
): () => void {
  accessTokenListeners.add(listener);
  return () => {
    accessTokenListeners.delete(listener);
  };
}
let refreshPromise: Promise<AccessTokenResponse> | null = null;
let unauthorizedHandler: (() => void) | null = null;

function portalAuthPath(action: string): string {
  return `/auth/${getCurrentPortal()}/${action}`;
}

interface RequestOptions {
  authenticated?: boolean;
  retryOnUnauthorized?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    ApiEnvelope<T> | ApiErrorEnvelope | null;

  if (!response.ok || !payload || payload.success === false) {
    const errorPayload = payload && payload.success === false ? payload : null;
    throw new ApiError(
      errorPayload?.message ??
        "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
      response.status,
      errorPayload?.errors ?? [],
    );
  }

  return payload.data;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const { authenticated = false, retryOnUnauthorized = true } = options;
  const requestToken = accessToken;
  const headers = new Headers(init.headers);

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (authenticated && requestToken) {
    headers.set("Authorization", `Bearer ${requestToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (response.status === 401 && authenticated && retryOnUnauthorized) {
    if (!accessToken || accessToken === requestToken)
      await refreshAccessToken();
    return request<T>(path, init, {
      authenticated: true,
      retryOnUnauthorized: false,
    });
  }

  if (
    response.status === 401 &&
    authenticated &&
    accessToken === requestToken
  ) {
    setAccessToken(null);
    unauthorizedHandler?.();
  }

  return readResponse<T>(response);
}

async function refreshAccessToken(): Promise<AccessTokenResponse> {
  if (!refreshPromise) {
    refreshPromise = request<AccessTokenResponse>(
      portalAuthPath("refresh-token"),
      { method: "POST" },
      { retryOnUnauthorized: false },
    )
      .then((tokens) => {
        setAccessToken(tokens.accessToken);
        return tokens;
      })
      .catch((error: unknown) => {
        setAccessToken(null);
        unauthorizedHandler?.();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export function authenticatedRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return request<T>(path, init, { authenticated: true });
}

export async function getRealtimeAccessToken(
  forceRefresh = false,
): Promise<string> {
  if (refreshPromise) {
    await refreshPromise;
    forceRefresh = false;
  }
  let expiresSoon = true;
  if (accessToken) {
    try {
      const payload = JSON.parse(
        atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      ) as { exp?: number };
      expiresSoon = !payload.exp || payload.exp * 1000 <= Date.now() + 30_000;
    } catch {
      /* Refresh malformed or expired credentials before connecting. */
    }
  }
  if (forceRefresh || !accessToken || expiresSoon) await refreshAccessToken();
  if (!accessToken)
    throw new ApiError("Phiên đăng nhập không hợp lệ hoặc đã hết hạn", 401);
  return accessToken;
}

export type UploadProgressPhase = "uploading" | "processing";

export function authenticatedUploadRequest<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number, phase: UploadProgressPhase) => void,
): Promise<T> {
  function send(retryOnUnauthorized: boolean): Promise<T> {
    const requestToken = accessToken;
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}${path}`);
      xhr.withCredentials = true;
      if (requestToken) {
        xhr.setRequestHeader("Authorization", `Bearer ${requestToken}`);
      }

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable || event.total === 0) return;
        onProgress(Math.round((event.loaded / event.total) * 70), "uploading");
      });
      xhr.upload.addEventListener("load", () => {
        onProgress(70, "processing");
      });
      xhr.addEventListener("error", () => {
        reject(
          new ApiError("Không thể kết nối đến máy chủ. Vui lòng thử lại.", 0),
        );
      });
      xhr.addEventListener("load", () => {
        void (async () => {
          if (xhr.status === 401 && retryOnUnauthorized) {
            try {
              if (!accessToken || accessToken === requestToken)
                await refreshAccessToken();
              resolve(await send(false));
            } catch (error) {
              reject(error);
            }
            return;
          }
          if (xhr.status === 401 && accessToken === requestToken) {
            setAccessToken(null);
            unauthorizedHandler?.();
          }

          const payload = (() => {
            try {
              return JSON.parse(xhr.responseText) as
                ApiEnvelope<T> | ApiErrorEnvelope;
            } catch {
              return null;
            }
          })();
          if (
            xhr.status < 200 ||
            xhr.status >= 300 ||
            !payload ||
            payload.success === false
          ) {
            const errorPayload =
              payload && payload.success === false ? payload : null;
            reject(
              new ApiError(
                errorPayload?.message ??
                  "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
                xhr.status,
                errorPayload?.errors ?? [],
              ),
            );
            return;
          }
          resolve(payload.data);
        })();
      });
      xhr.send(formData);
    });
  }

  return send(true);
}

async function requestBlob(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<Blob> {
  const requestToken = accessToken;
  const headers = new Headers(init.headers);
  if (requestToken) {
    headers.set("Authorization", `Bearer ${requestToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (response.status === 401 && retryOnUnauthorized) {
    if (!accessToken || accessToken === requestToken)
      await refreshAccessToken();
    return requestBlob(path, init, false);
  }
  if (response.status === 401 && accessToken === requestToken) {
    setAccessToken(null);
    unauthorizedHandler?.();
  }
  if (!response.ok) {
    return readResponse<never>(response);
  }
  return response.blob();
}

export function authenticatedBlobRequest(
  path: string,
  init: RequestInit = {},
): Promise<Blob> {
  return requestBlob(path, init);
}

export const authApi = {
  requestPasswordReset(accountName: string): Promise<OtpChallenge> {
    return request<OtpChallenge>(portalAuthPath("password-reset/request"), {
      method: "POST",
      body: JSON.stringify({ accountName }),
    });
  },
  resetPassword(payload: ResetPasswordPayload): Promise<Record<string, never>> {
    return request<Record<string, never>>(
      portalAuthPath("password-reset/confirm"),
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  requestFirstLoginOtp(email: string): Promise<OtpChallenge> {
    return authenticatedRequest<OtpChallenge>(
      "/auth/student/first-login/request-otp",
      { method: "POST", body: JSON.stringify({ email }) },
    );
  },
  completeFirstLogin(
    payload: ResetPasswordPayload & { email: string },
  ): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      "/auth/student/first-login/complete",
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  async login(payload: LoginPayload): Promise<AuthSession> {
    const session = await request<AuthSession>(portalAuthPath("login"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAccessToken(session.accessToken);
    return session;
  },

  async register(payload: RegisterPayload): Promise<AuthSession> {
    const session = await request<AuthSession>("/auth/student/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAccessToken(session.accessToken);
    return session;
  },

  refresh(): Promise<AccessTokenResponse> {
    return refreshAccessToken();
  },

  me(): Promise<User> {
    return authenticatedRequest<User>("/auth/me");
  },

  updateProfile(payload: UpdateProfilePayload): Promise<User> {
    return authenticatedRequest<User>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  updateAvatar(file: File): Promise<User> {
    const formData = new FormData();
    formData.append("file", file);
    return authenticatedUploadRequest<User>(
      "/auth/profile/avatar",
      formData,
      () => undefined,
    );
  },

  removeAvatar(): Promise<User> {
    return authenticatedRequest<User>("/auth/profile/avatar", {
      method: "DELETE",
    });
  },

  async logout(): Promise<Record<string, never>> {
    try {
      return await authenticatedRequest<Record<string, never>>(
        portalAuthPath("logout"),
        { method: "POST" },
      );
    } finally {
      setAccessToken(null);
    }
  },

  async logoutAll(): Promise<Record<string, never>> {
    try {
      return await authenticatedRequest<Record<string, never>>(
        portalAuthPath("logout-all"),
        {
          method: "POST",
        },
      );
    } finally {
      setAccessToken(null);
    }
  },

  sessions(): Promise<LoginSessionInfo[]> {
    return authenticatedRequest<LoginSessionInfo[]>("/auth/sessions");
  },

  revokeSession(sessionId: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `${portalAuthPath("sessions")}/${encodeURIComponent(sessionId)}`,
      { method: "DELETE" },
    );
  },

  clearAccessToken(): void {
    setAccessToken(null);
  },

  setUnauthorizedHandler(handler: (() => void) | null): void {
    unauthorizedHandler = handler;
  },
};
