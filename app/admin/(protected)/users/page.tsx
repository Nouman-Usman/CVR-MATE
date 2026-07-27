import { Suspense } from "react";
import { AdminUsersDashboard } from "@/components/admin/AdminUsersDashboard";

export const metadata = { title: "User Management — CVR-MATE Admin" };

export default function AdminUsersPage() {
  return (
    <Suspense>
      <AdminUsersDashboard />
    </Suspense>
  );
}
