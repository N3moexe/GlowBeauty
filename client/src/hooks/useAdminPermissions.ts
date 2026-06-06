import { trpc } from "@/lib/trpc";

export function useAdminPermissions(enabled = true) {
  const {
    data: permissions,
    isLoading,
    error,
  } = trpc.rbac.me.useQuery(undefined, { enabled, retry: false });
  return { permissions: permissions ?? null, isLoading, error: error ?? null };
}
