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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Key, Copy, Trash2, AlertTriangle } from "lucide-react";

// ---- Types ----

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
  status: "active" | "expired" | "revoked";
}

// ---- Hook ----

function useApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  return { keys, isLoading, refetch: fetchKeys };
}

// ---- Status badge ----

const statusClass: Record<string, string> = {
  active:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  expired:
    "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
  revoked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass[status] ?? statusClass.expired}`}
    >
      {status}
    </span>
  );
}

// ---- Page ----

export default function ApiKeysPage() {
  const { keys, isLoading, refetch } = useApiKeys();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>(["read"]);
  const [newExpiration, setNewExpiration] = useState("90d");
  const [creating, setCreating] = useState(false);

  // Reveal dialog state (shown after creation)
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirmation
  const [revokeId, setRevokeId] = useState<string | null>(null);

  function toggleScope(scope: string) {
    setNewScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  function resetCreateForm() {
    setNewName("");
    setNewScopes(["read"]);
    setNewExpiration("90d");
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          scopes: newScopes,
          expiresIn: newExpiration,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("API key created");
        resetCreateForm();
        setCreateOpen(false);
        setRevealKey(data.key?.plaintext ?? data.key);
        refetch();
      } else {
        toast.error("Failed to create API key");
      }
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    try {
      const res = await fetch(`/api/admin/api-keys?keyId=${keyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("API key revoked");
        setRevokeId(null);
        refetch();
      } else {
        toast.error("Failed to revoke API key");
      }
    } catch {
      toast.error("Failed to revoke API key");
    }
  }

  function handleCopyKey() {
    if (revealKey) {
      navigator.clipboard.writeText(revealKey);
      setCopied(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Create and manage API keys for programmatic access.
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger
                render={
                  <Button size="sm">
                    <Plus className="size-4" data-icon="inline-start" />
                    Create API Key
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key for your application.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g. Production Server"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Scopes</Label>
                    <div className="space-y-2">
                      {[
                        {
                          value: "read",
                          label: "Read",
                          desc: "Read access to resources",
                        },
                        {
                          value: "write",
                          label: "Write",
                          desc: "Create and update resources",
                        },
                        {
                          value: "admin",
                          label: "Admin",
                          desc: "Full administrative access",
                        },
                      ].map((scope) => (
                        <label
                          key={scope.value}
                          className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={newScopes.includes(scope.value)}
                            onCheckedChange={() => toggleScope(scope.value)}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-medium">
                              {scope.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {scope.desc}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Expiration</Label>
                    <Select
                      value={newExpiration}
                      onValueChange={(val) => setNewExpiration(val ?? "90d")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30d">30 days</SelectItem>
                        <SelectItem value="90d">90 days</SelectItem>
                        <SelectItem value="180d">180 days</SelectItem>
                        <SelectItem value="365d">1 year</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim() || newScopes.length === 0}
                  >
                    {creating ? "Creating..." : "Create Key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28 font-mono" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Key className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No API keys</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an API key to get started with the API.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="text-sm font-medium">
                      {key.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {key.prefix}...
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="secondary">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.lastUsed
                        ? new Date(key.lastUsed).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.expiresAt
                        ? new Date(key.expiresAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={key.status} />
                    </TableCell>
                    <TableCell>
                      {key.status === "active" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setRevokeId(key.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                          <span className="sr-only">Revoke</span>
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

      {/* Reveal Key Dialog */}
      <Dialog
        open={revealKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevealKey(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy your API key now. You will not be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Make sure to copy your API key now. You will not be able to see
                it again after closing this dialog.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={revealKey ?? ""}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyKey}
              >
                <Copy className="size-4" />
                <span className="sr-only">Copy</span>
              </Button>
            </div>
            {copied && (
              <p className="text-xs text-green-600">Copied to clipboard</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => { setRevealKey(null); setCopied(false); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog
        open={revokeId !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this API key? Applications using
              this key will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => revokeId && handleRevoke(revokeId)}
            >
              Revoke Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
