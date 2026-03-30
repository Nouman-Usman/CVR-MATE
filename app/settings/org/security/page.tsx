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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Shield,
  Plus,
  Trash2,
  MonitorSmartphone,
  LogOut,
  Lock,
} from "lucide-react";

// ---- Types ----

interface SSOConfig {
  provider: string;
  entityId: string;
  ssoUrl: string;
  certificate: string;
  enforced: boolean;
}

interface IPEntry {
  id: string;
  cidr: string;
  description: string;
  createdAt: string;
}

interface ActiveSession {
  id: string;
  userName: string;
  ipAddress: string;
  userAgent: string;
  lastActive: string;
  current: boolean;
}

interface SecuritySettings {
  sso: SSOConfig;
  twoFactorEnforced: boolean;
  ipAllowlist: IPEntry[];
  sessions: ActiveSession[];
}

// ---- Hook ----

function useSecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/security");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, isLoading, refetch: fetchSettings };
}

// ---- Page ----

export default function SecurityPage() {
  const { settings, isLoading, refetch } = useSecuritySettings();

  // SSO form state
  const [ssoProvider, setSsoProvider] = useState("");
  const [ssoEntityId, setSsoEntityId] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [ssoCertificate, setSsoCertificate] = useState("");
  const [ssoEnforced, setSsoEnforced] = useState(false);
  const [ssoSaving, setSsoSaving] = useState(false);

  // 2FA state
  const [twoFactorEnforced, setTwoFactorEnforced] = useState(false);

  // IP allowlist state
  const [newCidr, setNewCidr] = useState("");
  const [newCidrDesc, setNewCidrDesc] = useState("");

  // Sync form when settings load
  useEffect(() => {
    if (settings) {
      if (settings.sso) {
        setSsoProvider(settings.sso.provider ?? "");
        setSsoEntityId(settings.sso.entityId ?? "");
        setSsoUrl(settings.sso.ssoUrl ?? "");
        setSsoCertificate(settings.sso.certificate ?? "");
        setSsoEnforced(settings.sso.enforced ?? false);
      }
      setTwoFactorEnforced(settings.twoFactorEnforced ?? false);
    }
  }, [settings]);

  async function handleSaveSSO() {
    setSsoSaving(true);
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_sso",
          provider: ssoProvider,
          entityId: ssoEntityId,
          ssoUrl,
          certificate: ssoCertificate,
          enforced: ssoEnforced,
        }),
      });
      if (res.ok) {
        toast.success("SSO configuration saved");
        refetch();
      } else {
        toast.error("Failed to save SSO configuration");
      }
    } catch {
      toast.error("Failed to save SSO configuration");
    } finally {
      setSsoSaving(false);
    }
  }

  async function handleToggle2FA(enforced: boolean) {
    setTwoFactorEnforced(enforced);
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_2fa", required: enforced }),
      });
      if (res.ok) {
        toast.success(
          enforced ? "2FA enforcement enabled" : "2FA enforcement disabled"
        );
      } else {
        toast.error("Failed to update 2FA setting");
        setTwoFactorEnforced(!enforced);
      }
    } catch {
      toast.error("Failed to update 2FA setting");
      setTwoFactorEnforced(!enforced);
    }
  }

  async function handleAddIP() {
    if (!newCidr.trim()) return;
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_ip", cidr: newCidr, description: newCidrDesc }),
      });
      if (res.ok) {
        toast.success("IP address added to allowlist");
        setNewCidr("");
        setNewCidrDesc("");
        refetch();
      } else {
        toast.error("Failed to add IP address");
      }
    } catch {
      toast.error("Failed to add IP address");
    }
  }

  async function handleRemoveIP(id: string) {
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_ip", ruleId: id }),
      });
      if (res.ok) {
        toast.success("IP address removed");
        refetch();
      } else {
        toast.error("Failed to remove IP address");
      }
    } catch {
      toast.error("Failed to remove IP address");
    }
  }

  async function handleRevokeSession(sessionId: string) {
    try {
      const res = await fetch(`/api/admin/security/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Session revoked");
        refetch();
      } else {
        toast.error("Failed to revoke session");
      }
    } catch {
      toast.error("Failed to revoke session");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const ipAllowlist = settings?.ipAllowlist ?? [];
  const sessions = settings?.sessions ?? [];

  return (
    <div className="space-y-6">
      {/* SSO Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-4" />
            SSO Configuration
          </CardTitle>
          <CardDescription>
            Configure Single Sign-On for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Identity Provider</Label>
              <Select value={ssoProvider} onValueChange={(val) => setSsoProvider(val ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="okta">Okta</SelectItem>
                  <SelectItem value="azure-ad">Azure AD</SelectItem>
                  <SelectItem value="google">Google Workspace</SelectItem>
                  <SelectItem value="onelogin">OneLogin</SelectItem>
                  <SelectItem value="custom-saml">Custom SAML</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sso-entity-id">Entity ID</Label>
              <Input
                id="sso-entity-id"
                value={ssoEntityId}
                onChange={(e) => setSsoEntityId(e.target.value)}
                placeholder="https://your-idp.example.com/entity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sso-url">SSO URL</Label>
              <Input
                id="sso-url"
                value={ssoUrl}
                onChange={(e) => setSsoUrl(e.target.value)}
                placeholder="https://your-idp.example.com/sso"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sso-cert">Certificate</Label>
              <Textarea
                id="sso-cert"
                value={ssoCertificate}
                onChange={(e) => setSsoCertificate(e.target.value)}
                placeholder="Paste your X.509 certificate here..."
                className="font-mono text-xs"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enforce SSO</p>
                <p className="text-xs text-muted-foreground">
                  Require all members to authenticate via SSO.
                </p>
              </div>
              <Switch
                checked={ssoEnforced}
                onCheckedChange={setSsoEnforced}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSSO} disabled={ssoSaving}>
                {ssoSaving ? "Saving..." : "Save SSO Configuration"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2FA Enforcement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Require all organization members to use 2FA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Enforce 2FA for all members</p>
              <p className="text-xs text-muted-foreground">
                Members without 2FA will be required to set it up on their next
                login.
              </p>
            </div>
            <Switch
              checked={twoFactorEnforced}
              onCheckedChange={handleToggle2FA}
            />
          </div>
        </CardContent>
      </Card>

      {/* IP Allowlist */}
      <Card>
        <CardHeader>
          <CardTitle>IP Allowlist</CardTitle>
          <CardDescription>
            Restrict access to specific IP addresses or CIDR ranges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="new-cidr">CIDR Range</Label>
              <Input
                id="new-cidr"
                value={newCidr}
                onChange={(e) => setNewCidr(e.target.value)}
                placeholder="e.g. 192.168.1.0/24"
                className="font-mono"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="new-cidr-desc">Description</Label>
              <Input
                id="new-cidr-desc"
                value={newCidrDesc}
                onChange={(e) => setNewCidrDesc(e.target.value)}
                placeholder="e.g. Office network"
              />
            </div>
            <Button onClick={handleAddIP} disabled={!newCidr.trim()}>
              <Plus className="size-4" data-icon="inline-start" />
              Add
            </Button>
          </div>

          {ipAllowlist.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No IP restrictions configured. All IPs are allowed.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CIDR</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ipAllowlist.map((ip) => (
                  <TableRow key={ip.id}>
                    <TableCell className="font-mono text-sm">
                      {ip.cidr}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ip.description}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(ip.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveIP(ip.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MonitorSmartphone className="size-4" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            View and manage active sessions across your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No active sessions found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="text-sm font-medium">
                      {session.userName}
                      {session.current && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Current
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {session.ipAddress}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(session.lastActive).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {!session.current && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRevokeSession(session.id)}
                        >
                          <LogOut className="size-4 text-destructive" />
                          <span className="sr-only">Revoke session</span>
                        </Button>
                      )}
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
