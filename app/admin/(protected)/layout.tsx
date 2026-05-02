import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin-session")?.value;
  const adminEmail = await verifyAdminToken(adminCookie);

  if (!adminEmail) {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
