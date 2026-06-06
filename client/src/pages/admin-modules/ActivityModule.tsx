import { useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { RetryPanel } from "@/pages/admin-modules/shared/RetryPanel";
import { ShimmerBlock } from "@/pages/admin-modules/shared/ShimmerBlock";
import { getErrorMessage } from "@/pages/admin-modules/shared/utils";
import { Surface } from "@/components/admin/ui/Surface";
import { Heading } from "@/components/admin/ui/Heading";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActivityLogRow = {
  id: number;
  adminId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  oldValues: string | null;
  newValues: string | null;
  description: string | null;
  createdAt: Date | string;
};

function actionColorClass(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("remove"))
    return "bg-rose-50 text-rose-700";
  if (a.includes("create") || a.includes("add"))
    return "bg-emerald-50 text-emerald-700";
  if (
    a.includes("update") ||
    a.includes("edit") ||
    a.includes("modify") ||
    a.includes("toggle")
  )
    return "bg-blue-50 text-blue-700";
  if (a.includes("login") || a.includes("auth") || a.includes("logout"))
    return "bg-purple-50 text-purple-700";
  return "bg-amber-50 text-amber-700";
}

function LogRow({ row }: { row: ActivityLogRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = row.oldValues != null || row.newValues != null;

  let oldObj: unknown = null;
  let newObj: unknown = null;
  if (hasDiff) {
    try {
      oldObj = row.oldValues ? JSON.parse(row.oldValues) : null;
    } catch {
      oldObj = row.oldValues;
    }
    try {
      newObj = row.newValues ? JSON.parse(row.newValues) : null;
    } catch {
      newObj = row.newValues;
    }
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
            actionColorClass(row.action)
          )}
        >
          {row.action}
        </span>
        <span className="text-xs text-[var(--admin-muted)]">
          {row.entityType}
          {row.entityId != null ? ` #${row.entityId}` : ""}
        </span>
        {row.description ? (
          <span className="text-sm text-[var(--admin-ink)]/80">
            {row.description}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-[var(--admin-muted)]">
          {new Date(row.createdAt).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      </div>

      {hasDiff ? (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-1 flex items-center gap-1 text-xs text-[var(--admin-accent)] hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Masquer les modifications
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Voir les modifications
            </>
          )}
        </button>
      ) : null}

      {expanded && hasDiff ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {oldObj != null ? (
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--admin-muted)]">
                Avant
              </p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
                {JSON.stringify(oldObj, null, 2)}
              </pre>
            </div>
          ) : null}
          {newObj != null ? (
            <div>
              <p className="mb-1 text-xs font-medium text-[var(--admin-muted)]">
                Après
              </p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
                {JSON.stringify(newObj, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ActivityModule() {
  const query = trpc.activityLogs.list.useQuery(
    { limit: 100, offset: 0 },
    { refetchInterval: 30000 }
  );

  const rows = useMemo(
    () => (query.data ?? []) as ActivityLogRow[],
    [query.data]
  );

  if (query.error) {
    return (
      <RetryPanel
        title="Journal d'audit indisponible"
        description={getErrorMessage(
          query.error,
          "Impossible de charger le journal d'audit."
        )}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  return (
    <section className="space-y-4">
      <Surface className="p-4 md:p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--admin-accent)]" />
          <Heading level={3}>Journal d'audit</Heading>
          {rows.length > 0 ? (
            <span className="text-xs text-[var(--admin-muted)]">
              {rows.length} entrée{rows.length > 1 ? "s" : ""}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="ml-auto h-9 w-9 border-[var(--admin-border)]"
            title="Rafraîchir"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {query.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ShimmerBlock key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--admin-muted)]">
            Aucune activité enregistrée pour le moment.
          </p>
        ) : (
          <div className="divide-y divide-[var(--admin-divider)]">
            {rows.map(row => (
              <LogRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </Surface>
    </section>
  );
}
