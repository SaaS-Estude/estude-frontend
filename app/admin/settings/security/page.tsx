import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";

export default function SecuritySettingsPage() {
  return (
    <RoleGate allowedRole="ADMIN">
      <StaffDashboardView />
    </RoleGate>
  );
}
