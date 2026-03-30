"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Building2, Upload, AlertTriangle, Plus } from "lucide-react";

// ---- Types ----

interface OrgSettings {
  name: string;
  slug: string;
  logo: string | null;
  billingEmail: string;
  type: string;
}

// ---- Hook ----

function useOrgSettings() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/org");
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

// ---- Create Workspace Form ----

function CreateWorkspaceForm() {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        toast.success("Workspace created");
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create workspace");
      }
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="size-5" />
          Create Workspace
        </CardTitle>
        <CardDescription>
          Create a new team workspace to collaborate with your colleagues.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-org-name">Workspace Name</Label>
            <Input
              id="new-org-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Acme Sales Team"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <p className="text-xs text-muted-foreground">
              You can change this later in settings.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? "Creating..." : "Create Workspace"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Page ----

export default function OrgGeneralPage() {
  const searchParams = useSearchParams();
  const isCreateMode = searchParams.get("create") === "true";

  const { settings, isLoading, refetch } = useOrgSettings();

  const [name, setName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Sync form state when settings load
  useEffect(() => {
    if (settings) {
      setName(settings.name);
      setBillingEmail(settings.billingEmail ?? "");
    }
  }, [settings]);

  // Create mode — show creation form
  if (isCreateMode) {
    return <CreateWorkspaceForm />;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, billingEmail }),
      });
      if (res.ok) {
        toast.success("Organization settings saved");
        refetch();
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteInput !== settings?.name) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/org", { method: "DELETE" });
      if (res.ok) {
        toast.success("Organization deleted");
        // Redirect will be handled by auth
      } else {
        toast.error("Failed to delete organization");
      }
    } catch {
      toast.error("Failed to delete organization");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            Manage your organization&apos;s basic information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Organization"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug</Label>
                <Input
                  id="org-slug"
                  value={settings?.slug ?? ""}
                  readOnly
                  disabled
                  className="font-mono text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  The slug is used in URLs and cannot be changed.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {settings?.logo ? (
                    <img
                      src={settings.logo!}
                      alt="Organization logo"
                      className="size-16 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-lg border border-dashed bg-muted">
                      <Building2 className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <Button variant="outline" size="sm">
                      <Upload className="size-4" data-icon="inline-start" />
                      Upload Logo
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Recommended: 256x256px, PNG or SVG
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing-email">Billing Email</Label>
                <Input
                  id="billing-email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="billing@company.com"
                />
                <p className="text-xs text-muted-foreground">
                  Invoices and billing notifications will be sent to this
                  address.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium">Delete Organization</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete this organization and all of its data. This
                action cannot be undone.
              </p>
            </div>
            <Dialog
              open={deleteConfirmOpen}
              onOpenChange={setDeleteConfirmOpen}
            >
              <DialogTrigger
                render={
                  <Button variant="destructive" size="sm">
                    Delete Organization
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete Organization</DialogTitle>
                  <DialogDescription>
                    This action is permanent and cannot be undone. All data,
                    members, and settings will be permanently deleted.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p className="text-xs text-destructive">
                      This will permanently delete the organization{" "}
                      <strong>{settings?.name}</strong>, including all members,
                      teams, data, and settings.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm">
                      Type <strong>{settings?.name}</strong> to confirm
                    </Label>
                    <Input
                      id="delete-confirm"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder={settings?.name}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting || deleteInput !== settings?.name}
                  >
                    {deleting ? "Deleting..." : "Delete Organization"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
