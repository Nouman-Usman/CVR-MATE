"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession, authClient } from "@/lib/auth-client";
import { LogoFull } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  LogIn,
  UserPlus,
} from "lucide-react";

interface InvitationDetails {
  id: string;
  organizationName: string;
  inviterName: string;
  role: string;
  email: string;
  status: "pending" | "expired" | "accepted" | "rejected" | "canceled" | "not_found";
  expiresAt: string;
  isAlreadyMember: boolean;
  isInvitee: boolean;
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteContent />
    </Suspense>
  );
}

function InviteContent() {
  const router = useRouter();
  const params = useParams();
  const invitationId = params.invitationId as string;
  const { data: session, isPending: sessionLoading } = useSession();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [result, setResult] = useState<"accepted" | "declined" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch invitation details
  const fetchInvitation = useCallback(async () => {
    try {
      const res = await fetch(`/api/team/invitations/${invitationId}/details`);
      if (!res.ok) {
        setInvitation({
          id: invitationId,
          organizationName: "",
          inviterName: "",
          role: "",
          email: "",
          status: "not_found",
          expiresAt: "",
          isAlreadyMember: false,
          isInvitee: false,
        });
        return;
      }
      const data = await res.json();
      setInvitation(data);

      // If already a member, redirect after short delay
      if (data.isAlreadyMember) {
        setTimeout(() => router.push("/settings?tab=team"), 2000);
      }
    } catch {
      setInvitation({
        id: invitationId,
        organizationName: "",
        inviterName: "",
        role: "",
        email: "",
        status: "not_found",
        expiresAt: "",
        isAlreadyMember: false,
        isInvitee: false,
      });
    } finally {
      setLoading(false);
    }
  }, [invitationId, router]);

  useEffect(() => {
    if (invitationId) fetchInvitation();
  }, [invitationId, fetchInvitation]);

  // Re-fetch when session loads (to update isAlreadyMember/isInvitee)
  useEffect(() => {
    if (!sessionLoading && session?.user && invitation && !invitation.isInvitee) {
      fetchInvitation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading]);

  const handleAccept = async () => {
    setAccepting(true);
    setErrorMessage("");
    try {
      const res = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (res.error) {
        setErrorMessage(res.error.message || "Failed to accept invitation");
        setResult("error");
      } else {
        setResult("accepted");
        // Set active org + log audit event (fire-and-forget)
        const orgId = (res.data as { member?: { organizationId?: string } })?.member?.organizationId;
        if (orgId) {
          authClient.organization.setActive({ organizationId: orgId }).catch(() => {});
        }
        fetch(`/api/team/invitations/${invitationId}/accepted`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
        setTimeout(() => router.push("/settings?tab=team"), 2000);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to accept invitation");
      setResult("error");
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await fetch(`/api/team/invitations/${invitationId}/decline`, {
        method: "POST",
        credentials: "include",
      });
      setResult("declined");
    } catch {
      // Soft failure — just show declined state
      setResult("declined");
    } finally {
      setDeclining(false);
    }
  };

  // Compute time remaining
  const timeRemaining = invitation?.expiresAt
    ? getTimeRemaining(invitation.expiresAt)
    : "";

  const roleBadgeColor =
    invitation?.role === "admin"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  // ── Loading ──
  if (loading || sessionLoading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 text-blue-600 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading invitation...</p>
        </div>
      </Shell>
    );
  }

  // ── Not found ──
  if (!invitation || invitation.status === "not_found") {
    return (
      <Shell>
        <StateCard
          icon={<AlertCircle className="size-8 text-slate-400" />}
          iconBg="bg-slate-100"
          title="Invalid invitation"
          description="This invitation link is invalid or has been removed."
        >
          <Button variant="outline" onClick={() => router.push("/login")}>
            Go to login
          </Button>
        </StateCard>
      </Shell>
    );
  }

  // ── Expired ──
  if (invitation.status === "expired") {
    return (
      <Shell>
        <StateCard
          icon={<Clock className="size-8 text-amber-600" />}
          iconBg="bg-amber-50"
          title="Invitation expired"
          description={`This invitation to join ${invitation.organizationName} has expired. Contact ${invitation.inviterName} to request a new one.`}
        >
          <Button variant="outline" onClick={() => router.push("/login")}>
            Go to login
          </Button>
        </StateCard>
      </Shell>
    );
  }

  // ── Already accepted / rejected / canceled ──
  if (invitation.status === "accepted") {
    return (
      <Shell>
        <StateCard
          icon={<CheckCircle2 className="size-8 text-emerald-600" />}
          iconBg="bg-emerald-50"
          title="Already accepted"
          description={`You've already joined ${invitation.organizationName}.`}
        >
          <Button onClick={() => router.push("/settings?tab=team")}>
            Go to team settings
          </Button>
        </StateCard>
      </Shell>
    );
  }

  if (invitation.status === "rejected" || invitation.status === "canceled") {
    return (
      <Shell>
        <StateCard
          icon={<XCircle className="size-8 text-slate-400" />}
          iconBg="bg-slate-100"
          title={invitation.status === "rejected" ? "Invitation declined" : "Invitation canceled"}
          description={
            invitation.status === "rejected"
              ? "You declined this invitation."
              : "This invitation was canceled by the team admin."
          }
        >
          <Button variant="outline" onClick={() => router.push("/login")}>
            Go to login
          </Button>
        </StateCard>
      </Shell>
    );
  }

  // ── Already a member ──
  if (invitation.isAlreadyMember) {
    return (
      <Shell>
        <StateCard
          icon={<CheckCircle2 className="size-8 text-emerald-600" />}
          iconBg="bg-emerald-50"
          title="Already a member"
          description={`You're already a member of ${invitation.organizationName}. Redirecting...`}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Redirecting to team settings</span>
          </div>
        </StateCard>
      </Shell>
    );
  }

  // ── Accepted / Declined result ──
  if (result === "accepted") {
    return (
      <Shell>
        <StateCard
          icon={<CheckCircle2 className="size-8 text-emerald-600" />}
          iconBg="bg-emerald-50"
          title={`Welcome to ${invitation.organizationName}!`}
          description={`You've joined as ${invitation.role}. Redirecting to your team...`}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Taking you to team settings</span>
          </div>
        </StateCard>
      </Shell>
    );
  }

  if (result === "declined") {
    return (
      <Shell>
        <StateCard
          icon={<XCircle className="size-8 text-slate-400" />}
          iconBg="bg-slate-100"
          title="Invitation declined"
          description="You've declined this invitation. The team admin has been notified."
        >
          <Button variant="outline" onClick={() => router.push("/")}>
            Go to homepage
          </Button>
        </StateCard>
      </Shell>
    );
  }

  // ── Not authenticated — redirect to login ──
  if (!session?.user) {
    return (
      <Shell>
        <div className="space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Users className="size-8 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight font-[family-name:var(--font-manrope)]">
              You&apos;re invited to join
            </h1>
            <p className="text-lg font-bold text-foreground">
              {invitation.organizationName}
            </p>
            <p className="text-sm text-muted-foreground">
              {invitation.inviterName} invited you as{" "}
              <Badge variant="outline" className={`${roleBadgeColor} ml-1`}>
                {invitation.role}
              </Badge>
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 text-sm text-muted-foreground space-y-2 border">
            <p>Sign in or create an account to accept this invitation.</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() =>
                router.push(`/login?callbackUrl=/invite/${invitationId}`)
              }
              className="w-full"
            >
              <LogIn className="size-4 mr-2" />
              Sign in to accept
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/signup?callbackUrl=/invite/${invitationId}`)
              }
              className="w-full"
            >
              <UserPlus className="size-4 mr-2" />
              Create account
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Authenticated but wrong email ──
  if (!invitation.isInvitee) {
    return (
      <Shell>
        <StateCard
          icon={<AlertCircle className="size-8 text-amber-600" />}
          iconBg="bg-amber-50"
          title="Wrong account"
          description={`This invitation was sent to ${invitation.email}. You're signed in as ${session.user.email}. Sign in with the correct account to accept.`}
        >
          <Button
            onClick={() =>
              router.push(`/login?callbackUrl=/invite/${invitationId}`)
            }
          >
            Switch account
          </Button>
        </StateCard>
      </Shell>
    );
  }

  // ── Pending — show accept/decline ──
  return (
    <Shell>
      <div className="space-y-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Users className="size-8 text-blue-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight font-[family-name:var(--font-manrope)]">
            Join {invitation.organizationName}
          </h1>
          <p className="text-sm text-muted-foreground">
            <strong>{invitation.inviterName}</strong> invited you to join as
          </p>
          <Badge variant="outline" className={`${roleBadgeColor} text-sm`}>
            <Shield className="size-3.5 mr-1" />
            {invitation.role === "admin" ? "Admin" : "Member"}
          </Badge>
        </div>

        {/* Info card */}
        <div className="bg-slate-50 rounded-xl p-5 text-left text-sm border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Organization</span>
            <span className="font-semibold text-foreground">
              {invitation.organizationName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Invited by</span>
            <span className="font-medium text-foreground">
              {invitation.inviterName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Your role</span>
            <span className="font-medium text-foreground capitalize">
              {invitation.role}
            </span>
          </div>
          {timeRemaining && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expires</span>
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Clock className="size-3" />
                {timeRemaining}
              </span>
            </div>
          )}
        </div>

        {/* Error message */}
        {result === "error" && errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleAccept}
            disabled={accepting || declining}
            className="w-full"
            size="lg"
          >
            {accepting ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="size-4 mr-2" />
            )}
            {accepting ? "Joining..." : "Accept invitation"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleDecline}
            disabled={accepting || declining}
            className="w-full text-muted-foreground hover:text-destructive"
            size="sm"
          >
            {declining ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : null}
            Decline
          </Button>
        </div>
      </div>
    </Shell>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[440px] space-y-8">
        <div className="flex justify-center">
          <LogoFull size="large" />
        </div>
        {children}
      </div>
    </main>
  );
}

function StateCard({
  icon,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center space-y-6">
      <div
        className={`mx-auto w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center`}
      >
        {icon}
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight font-[family-name:var(--font-manrope)]">
          {title}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h remaining`;
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  return `${minutes}m remaining`;
}
