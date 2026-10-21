import { RoleGate } from "@/components/auth/role-gate";
import { StaffDashboardView } from "@/components/dashboard/staff-dashboard-view";
export default function Page() { return <RoleGate allowedRole="ADMIN"><StaffDashboardView /></RoleGate>; }
