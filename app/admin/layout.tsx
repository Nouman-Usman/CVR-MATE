import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrgMembership } from "@/lib/team/permissions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const org = session.session?.activeOrganizationId;
  if (!org) {
    redirect("/dashboard");
  }

  const membership = await getOrgMembership(session.user.id, org);
  if (!membership || membership.role !== "owner") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
