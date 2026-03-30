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
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, Users, ChevronDown, ChevronUp, Trash2, Pencil } from "lucide-react";

// ---- Types ----

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
  lead: string;
  memberCount: number;
  color: string;
  members?: TeamMember[];
}

// ---- Hook ----

function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return { teams, isLoading, refetch: fetchTeams };
}

// ---- Color options ----

const teamColors = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Red", value: "#ef4444" },
  { name: "Yellow", value: "#eab308" },
];

// ---- Page ----

export default function TeamsPage() {
  const { teams, isLoading, refetch } = useTeams();
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  // Create team form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColor, setNewColor] = useState(teamColors[0].value);
  const [creating, setCreating] = useState(false);

  function resetForm() {
    setNewName("");
    setNewDescription("");
    setNewColor(teamColors[0].value);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          color: newColor,
        }),
      });
      if (res.ok) {
        toast.success("Team created");
        resetForm();
        setCreateOpen(false);
        refetch();
      } else {
        toast.error("Failed to create team");
      }
    } catch {
      toast.error("Failed to create team");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(teamId: string) {
    try {
      const res = await fetch(`/api/admin/teams?teamId=${teamId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Team deleted");
        refetch();
      } else {
        toast.error("Failed to delete team");
      }
    } catch {
      toast.error("Failed to delete team");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Teams</CardTitle>
              <CardDescription>
                Organize members into teams and departments.
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger
                render={
                  <Button size="sm">
                    <Plus className="size-4" data-icon="inline-start" />
                    Create Team
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Team</DialogTitle>
                  <DialogDescription>
                    Add a new team to your organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="team-name">Team name</Label>
                    <Input
                      id="team-name"
                      placeholder="e.g. Sales, Engineering"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-desc">Description</Label>
                    <Input
                      id="team-desc"
                      placeholder="What does this team do?"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {teamColors.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setNewColor(c.value)}
                          className="flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110"
                          style={{ backgroundColor: c.value }}
                          aria-label={c.name}
                        >
                          {newColor === c.value && (
                            <svg
                              className="size-4 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                  >
                    {creating ? "Creating..." : "Create Team"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-3 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="mt-2 h-3 w-full" />
                  <div className="mt-3 flex items-center gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Users className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No teams yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first team to organize members.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {teams.map((team) => {
                const isExpanded = expandedTeam === team.id;
                return (
                  <div
                    key={team.id}
                    className="rounded-xl border transition-colors hover:border-foreground/20"
                  >
                    <button
                      type="button"
                      className="w-full p-4 text-left"
                      onClick={() =>
                        setExpandedTeam(isExpanded ? null : team.id)
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className="size-3 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="text-sm font-medium">
                            {team.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{team.memberCount}</Badge>
                          {isExpanded ? (
                            <ChevronUp className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      {team.description && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                          {team.description}
                        </p>
                      )}
                      {team.lead && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Lead: <span className="font-medium text-foreground">{team.lead}</span>
                        </p>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t px-4 py-3">
                        {team.members && team.members.length > 0 ? (
                          <ul className="space-y-2">
                            {team.members.map((m) => (
                              <li
                                key={m.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <div>
                                  <span className="font-medium">{m.name}</span>
                                  <span className="ml-2 text-muted-foreground">
                                    {m.email}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {m.role}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No members in this team yet.
                          </p>
                        )}
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleDelete(team.id)}
                          >
                            <Trash2 className="size-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
