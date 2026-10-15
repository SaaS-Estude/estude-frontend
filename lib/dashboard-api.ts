import { authenticatedRequest } from "@/lib/auth-api";
import type { DashboardOverview } from "@/types/dashboard";

export const dashboardService = {
  getOverview(): Promise<DashboardOverview> {
    return authenticatedRequest<DashboardOverview>("/dashboard/overview");
  },
};
