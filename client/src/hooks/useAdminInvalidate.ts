import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

export function useAdminInvalidate() {
  const utils = trpc.useUtils();

  return {
    all: useCallback(() => utils.invalidate(), [utils]),
    products: useCallback(
      () =>
        Promise.all([
          utils.product.list.invalidate(),
          utils.product.byId.invalidate(),
          utils.product.bySlug.invalidate(),
          utils.product.count.invalidate(),
          utils.reports.lowStock.invalidate(),
          utils.reports.bestSellers.invalidate(),
          utils.analytics.dashboard.invalidate(),
        ]),
      [utils]
    ),
    orders: useCallback(
      () =>
        Promise.all([
          utils.order.list.invalidate(),
          utils.order.byId.invalidate(),
          utils.analytics.dashboard.invalidate(),
        ]),
      [utils]
    ),
    cms: useCallback(
      () =>
        Promise.all([utils.cms.list.invalidate(), utils.cms.byId.invalidate()]),
      [utils]
    ),
    reviews: useCallback(
      () =>
        Promise.all([
          utils.reviews.adminList.invalidate(),
          utils.reviews.list.invalidate(),
          utils.reviews.averageRating.invalidate(),
        ]),
      [utils]
    ),
  };
}
