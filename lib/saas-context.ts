// Prepared for accepted Go modules. Existing auth-api keeps its configured URL.
export const GO_SAME_ORIGIN_API = '/api/v1';

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  portal: 'admin' | 'teacher' | 'student' | 'parent';
  branding: { logoUrl?: string; displayName: string; primaryColor: string; timezone: string; revision: number };
}

export async function loadTenantContext(fetcher: typeof fetch = fetch): Promise<TenantContext> {
  const response = await fetcher(`${GO_SAME_ORIGIN_API}/tenant`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const result = await response.json() as { success: boolean; data?: TenantContext };
  if (!response.ok || !result.success || !result.data) {
    throw new Error('Không thể xác định trường/trung tâm hiện tại');
  }
  return result.data;
}
