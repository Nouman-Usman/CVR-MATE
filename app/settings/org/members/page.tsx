"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Mail,
  UserMinus,
  ShieldCheck,
  Clock,
  Send,
  X,
} from "lucide-react";

// ---- Types ----

type Role = "owner" | "admin" | "manager" | "member" | "viewer";

interface Member {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
  role: Role;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: "pending" | "expired";
  createdAt: string;
}

// ---- Role badge colors ----

const roleBadgeClass: Record<Role, string> = {
  owner: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  admin:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  manager:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  member:
    "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  viewer: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleBadgeClass[role]}`}
    >
      {role}
    </span>
  );
}

function MemberAvatar({ name }: { name: string }) {
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {initials}
    </div>
  );
}

// ---- Data fetching hook ----

function useMembersData() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
        setInvitations(data.invitations ?? []);
      }
    } catch {
      // silently fail, will show empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { members, invitations, isLoading, refetch: fetchData };
}

// ---- Page ----

export default function MembersPage() {
  const { members, invitations, isLoading, refetch } = useMembersData();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviting, setInviting] = useState(false);

  async function handleInvite() {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        toast.success("Invitation sent successfully");
        setInviteEmail("");
        setInviteRole("member");
        setInviteOpen(false);
        refetch();
      } else {
        toast.error("Failed to send invitation");
      }
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleChangeRole(memberId: string, newRole: Role) {
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, newRole }),
      });
      if (res.ok) {
        toast.success("Role updated");
        refetch();
      } else {
        toast.error("Failed to update role");
      }
    } catch {
      toast.error("Failed to update role");
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      const res = await fetch(`/api/admin/members?memberId=${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Member removed");
        refetch();
      } else {
        toast.error("Failed to remove member");
      }
    } catch {
      toast.error("Failed to remove member");
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    try {
      const res = await fetch(
        `/api/admin/members?memberId=${invitationId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Invitation revoked");
        refetch();
      } else {
        toast.error("Failed to revoke invitation");
      }
    } catch {
      toast.error("Failed to revoke invitation");
    }
  }

  return (
    <div className="space-y-6">
      {/* Members Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                Manage who has access to your organization.
              </CardDescription>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger
                render={
                  <Button size="sm">
                    <Plus className="size-4" data-icon="inline-start" />
                    Invite Member
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(val) => setInviteRole(val as Role)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                    <Send className="size-4" data-icon="inline-start" />
                    {inviting ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Mail className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No members yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Invite team members to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={member.userName ?? member.userEmail} />
                        <div>
                          <p className="text-sm font-medium">{member.userName || member.userEmail}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.userEmail}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {member.role !== "owner" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            {(
                              ["admin", "manager", "member", "viewer"] as Role[]
                            )
                              .filter((r) => r !== member.role)
                              .map((role) => (
                                <DropdownMenuItem
                                  key={role}
                                  onClick={() =>
                                    handleChangeRole(member.id, role)
                                  }
                                >
                                  <ShieldCheck className="size-4" />
                                  Change to {role}
                                </DropdownMenuItem>
                              ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <UserMinus className="size-4" />
                              Remove member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Invitations that have been sent but not yet accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <Clock className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                No pending invitations
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm font-medium">
                      {inv.email}
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={inv.role} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.status === "pending" ? "secondary" : "outline"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRevokeInvitation(inv.id)}
                      >
                        <X className="size-4" />
                        <span className="sr-only">Revoke</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
