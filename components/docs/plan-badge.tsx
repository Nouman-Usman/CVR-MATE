import { Badge } from "@/components/ui/badge";
import type { DocBadge } from "@/lib/docs/types";

const styles: Record<DocBadge, string> = {
  Pro:        "bg-blue-600 text-white hover:bg-blue-600 text-[10px] px-1.5 py-0 font-semibold",
  Enterprise: "bg-violet-600 text-white hover:bg-violet-600 text-[10px] px-1.5 py-0 font-semibold",
  Starter:    "bg-slate-500 text-white hover:bg-slate-500 text-[10px] px-1.5 py-0 font-semibold",
};

export function PlanBadge({ badge }: { badge: DocBadge }) {
  return <Badge className={styles[badge]}>{badge}</Badge>;
}
