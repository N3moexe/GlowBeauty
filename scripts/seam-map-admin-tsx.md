# Admin.tsx Seam Map

## 1. File-level

- **Imports**: lines 1-103
  - React/tanstack, framer-motion, lucide, recharts, wouter -- all shared across modules
  - trpc, adminNavigation, adminAnalytics, adminRbac, utils -- shared
  - UI components (Button, Dialog, DataTable, etc.) -- shared
- **Type declarations**: lines 105-285
  - ProductEntity, CategoryEntity, OrderEntity, OrderDetailEntity, BannerEntity -- shared entity types
  - DashboardWidgetId, ProductFormState, HeroFormState, PromoFormState -- module-local form types
  - CmsPageEntity, CmsFormState, CouponEntity, CouponFormState, ReviewEntity -- module-local form types
- **Module-level constants**: lines 287-532
  - PRODUCT_MAX_BULLETS, PRODUCT_DEFAULT_ROUTINE_STEPS, PRODUCT_MAX_ROUTINE_STEPS, ROUTINE_TITLE_PRESETS, ROUTINE_CUSTOM_VALUE -> products
  - ALL_MODULES, DEFAULT_WIDGET_ORDER, WIDGET_TITLE -> shared / shell
  - ORDER_STATUS_OPTIONS, ORDER_PAYMENT_STATUS_OPTIONS -> orders
  - ANALYTICS_STATUS_COLORS -> dashboard-home
  - EMPTY_PRODUCT_FORM, EMPTY_HERO_FORM, EMPTY_PROMO_FORM, EMPTY_CMS_FORM, EMPTY_COUPON_FORM -> module-specific
  - SKINCARE_CATEGORY_PRESET -> products/categories
- **Pre-component helper functions** (lines 293-695):

  | Helper | Move to |
  |--------|---------|
  | sanitizeBulletArray | shared/productHelpers.ts |
  | sanitizeRoutineSteps | shared/productHelpers.ts |
  | createDefaultRoutineSteps | shared/productHelpers.ts |
  | createDefaultRoutine | shared/productHelpers.ts |
  | sanitizeRoutine | shared/productHelpers.ts |
  | resolveRoutinePresetValue | shared/productHelpers.ts |
  | moveArrayItem | shared/utils.ts |
  | createEmptyRoutineStep | shared/productHelpers.ts |
  | parseAdminModule | shared/utils.ts |
  | formatCFA | shared/formatters.ts |
  | formatPercent | shared/formatters.ts |
  | toDateLabel | shared/formatters.ts |
  | toDateInputValue | shared/formatters.ts |
  | getErrorMessage | shared/utils.ts |
  | slugify | shared/utils.ts |
  | normalizePaymentStatus | shared/utils.ts |
  | computeSeoScore | shared/utils.ts (used by CMS and products) |
  | escapeCsvCell | shared/csv.ts |
  | downloadCsv | shared/csv.ts |
  | readWidgetOrder | dashboard-home/utils.ts |
  | ShimmerBlock | shared/ShimmerBlock.tsx |
  | RetryPanel | shared/RetryPanel.tsx |

- **Admin() starts**: line 697

---

## 2. Inside Admin() -- linear walkthrough


### shell-auth  --  lines 707-714
- Kind: state
- Names: user, loading, logout, location, setLocation, params, requestedModule, shouldReduceMotion, utils, queryClient
- Module assignment: shell

### shell-ui-state  --  lines 715-731
- Kind: state
- Names (shell): activeModule, mobileSidebarOpen, sidebarCollapsed
- Names (dashboard-home): kpiPeriod, analyticsRangeDays, widgetOrder, draggedWidget
- Module assignment: shell + dashboard-home split
- Extraction note: kpiPeriod/analyticsRangeDays/widgetOrder/draggedWidget -> useDashboardHomeState hook

### products-state  --  lines 732-747
- Kind: state
- Names: productSearch, productCategoryFilter, productStockFilter, productSort, productModalOpen, editingProductId, productPendingDelete, productForm, productRoutineTab, productSlugTouched
- Module assignment: products

### orders-state  --  lines 749-759
- Kind: state + effect
- Names: orderSearch, orderStatusFilter, orderPage, selectedOrderId, debouncedOrderSearch
- Module assignment: orders
- Extraction note: Effect on line 757 resets orderPage on search/filter change; keep co-located.

---

## 3. Cross-module entanglements

### banners-homepage-state  --  lines 761-764
- Kind: state
- Names: heroForm, promoForm, featuredCategoryIds, homepageSaving
- Module assignment: dashboard-home (banners)

### cms-state  --  lines 766-775
- Kind: state
- Names: cmsSearch, cmsStatusFilter, cmsEditorOpen, cmsEditingId, cmsPendingDelete, cmsForm, cmsSlugTouched
- Module assignment: shell (cms)

### coupons-state  --  lines 777-786
- Kind: state
- Names: couponSearch, couponStatusFilter, couponModalOpen, editingCouponId, couponPendingDelete, couponForm
- Module assignment: shell (coupons)

### reviews-state  --  lines 788-793
- Kind: state
- Names: reviewSearch, reviewStatusFilter, reviewProductFilter, reviewPreview
- Module assignment: shell (reviews)

### inventory-state  --  lines 795-798
- Kind: state
- Names: inventorySearch, inventoryDraftStock
- Module assignment: products (inventory sub-module)

### settings-state  --  lines 800-807
- Kind: state
- Names: settingsSaving, paymentSettingsForm
- Module assignment: shell (settings)

### categories-state  --  lines 808-809
- Kind: state
- Names: categoryPresetApplying
- Module assignment: products

### permissions-query  --  lines 810-817
- Kind: query
- Names: permissions, permissionsLoading, permissionsError
- Module assignment: shell
- Extraction note: Gate query. Cannot leave shell.
### shell-effects  --  lines 819-837
- Kind: effect (x3)
- Names: sync activeModule from route; persist sidebarCollapsed; persist widgetOrder
- Module assignment: shell (first 2), dashboard-home (widgetOrder persistence)

### shell-derived-permissions  --  lines 839-889
- Kind: derived
- Names: allowedModules, rbac fallback effect, navigateToModule, canSeeOverview, canManageOrders, canManageProducts, canManageCms, canDeleteEntities, canEditHomepage
- Module assignment: shell
- Extraction note: All can* flags must be prop-drilled or in shared context on extraction.

### shared-invalidation-callbacks  --  lines 891-911
- Kind: handler
- Names: invalidateProductSurface, invalidateOrderSurface
- Module assignment: shared
- Extraction note: HIGH RISK -- invalidateProductSurface calls analytics.dashboard.invalidate() and queryClient.invalidateQueries([admin-analytics-overview]) crossing into dashboard-home territory.

### products-query  --  lines 913-932
- Kind: query
- Names: productsQuery
- Module assignment: products
- Extraction note: Also enabled for inventory/categories/analytics/reports. Must hoist to shell or shared context.

### categories-query  --  lines 934-947
- Kind: query
- Names: categoriesQuery
- Module assignment: shared (used by products, banners, analytics, reports, inventory, categories)

### orders-query  --  lines 949-976
- Kind: query
- Names: ordersQuery, orderTotal, orderPageCount, orderDetailQuery
- Module assignment: orders
- Extraction note: ordersQuery also enabled for analytics and search modules.

### analytics-queries  --  lines 978-1042
- Kind: query
- Names: analyticsPeriodQuery, analyticsTodayQuery, lowStockQuery, bestSellersQuery, salesByCategoryQuery, analyticsOverviewQuery
- Module assignment: dashboard-home
### settings-queries  --  lines 1044-1081
- Kind: query
- Names: storefrontQuery, homepageSettingsQuery, heroBannersQuery, paymentSettingsQuery, productSeoSettingsQuery
- Module assignment: dashboard-home (storefront/homepageSettings/heroBanners), shell/settings (paymentSettings), products (productSeoSettings)
- Extraction note: storefrontQuery also read in settings JSX for paymentMethodsText -- two-module consumer.

### coupons-reviews-cms-queries  --  lines 1083-1124
- Kind: query
- Names: couponsQuery, reviewsAdminQuery, cmsPagesQuery, cmsByIdQuery
- Module assignment: shell (coupons, reviews, cms)

### product-mutations  --  lines 1126-1148
- Kind: mutation
- Names: productCreateMutation, productUpdateMutation, productDeleteMutation
- Module assignment: products

### orders-mutations  --  lines 1150-1164
- Kind: mutation
- Names: orderUpdateStatusMutation, orderUpdatePaymentMutation
- Module assignment: orders

### cms-mutations  --  lines 1166-1205
- Kind: mutation
- Names: cmsCreateMutation, cmsUpdateMutation, cmsSetStatusMutation, cmsDeleteMutation
- Module assignment: shell (cms)

### settings-homepage-mutations  --  lines 1207-1229
- Kind: mutation
- Names: settingsSetMutation, bannerCreateMutation, bannerUpdateMutation, categoryUpdateMutation, categoryCreateMutation, categoryDeleteMutation
- Module assignment: shared (settingsSetMutation -- THREE modules); dashboard-home (banner*); products (category*)
- Extraction note: settingsSetMutation must remain in shell or a dedicated shared hook.

### reviews-coupons-mutations  --  lines 1231-1285
- Kind: mutation
- Names: reviewModerateMutation, reviewDeleteMutation, couponCreateMutation, couponUpdateMutation, couponToggleMutation, couponDeleteMutation
- Module assignment: shell (reviews, coupons)
### derived-rows  --  lines 1286-1366
- Kind: derived
- Names: productRows, orderRows, categoryRows, cmsRows, couponRows, reviewRows, productSeoById, categoryNameById
- Module assignment: distributed (each belongs with its module)
- Extraction note: categoryNameById used by both products table and inventory table.

### cms-sync-effect  --  lines 1368-1380
- Kind: effect
- Names: sync cmsByIdQuery into cmsForm when editor opens
- Module assignment: shell (cms)

### homepage-derived  --  lines 1382-1500
- Kind: derived + effects (x3)
- Names: heroBanner, homepageSettingsMap; effects syncing heroForm, promoForm, featuredCategoryIds
- Module assignment: dashboard-home (banners)
- Extraction note: featuredCategoryIds sync depends on categoryRows (shared query).

### payment-settings-sync-effect  --  lines 1456-1472
- Kind: effect
- Names: sync paymentSettingsForm from paymentSettingsQuery
- Module assignment: shell (settings)

### products-filtered  --  lines 1502-1563
- Kind: derived
- Names: filteredProducts
- Module assignment: products

### coupons-reviews-inventory-filtered  --  lines 1565-1627
- Kind: derived
- Names: filteredCoupons, filteredReviews, filteredInventoryRows
- Module assignment: coupons / reviews / products(inventory)

### analytics-derived-values  --  lines 1629-1685
- Kind: derived
- Names: ordersToday, totalRevenue, lowStockRows, lowStockCount, pendingOrderCount, liveConnected, bestSellerRows, categorySalesRows, analyticsOverview (+10 unpacked vars)
- Module assignment: dashboard-home

### revenue-trend-derived  --  lines 1687-1717
- Kind: derived
- Names: revenueTrend
- Dependencies: kpiPeriod, orderRows
- Module assignment: dashboard-home
- Extraction note: Uses orderRows from orders module. Orders must extract before or alongside dashboard-home.
### error-messages-derived  --  lines 1719-1806
- Kind: derived
- Names: productsErrorMessage, ordersErrorMessage, analyticsErrorMessage, analyticsOverviewErrorMessage, homepageEditorErrorMessage, productModuleErrorMessage, homepageEditorLoading, cmsErrorMessage, categoriesErrorMessage, couponsErrorMessage, reviewsErrorMessage, inventoryErrorMessage, settingsErrorMessage, publishedCmsCount, draftCmsCount, cmsAverageSeoScore
- Module assignment: distributed

### dashboard-notifications  --  lines 1808-1835
- Kind: derived
- Names: dashboardNotifications
- Dependencies: pendingOrderCount, lowStockCount, navigateToModule, setOrderStatusFilter
- Module assignment: shell (TopBar data) / dashboard-home (data source)
- Extraction note: setOrderStatusFilter called from notification click -- cross-module setter (dashboard-home -> orders).

### products-handlers  --  lines 1837-2063
- Kind: handler
- Names: openCreateProductDialog, openEditProductDialog, submitProductForm, handleDeleteProduct
- Module assignment: products
- Extraction note: submitProductForm calls settingsSetMutation for SEO fields.

### orders-handlers  --  lines 2065-2099
- Kind: handler
- Names: handleOrderStatusChange, handleOrderPaymentStatusChange
- Module assignment: orders

### coupons-handlers  --  lines 2101-2261
- Kind: handler
- Names: resetCouponEditor, openCreateCouponDialog, openEditCouponDialog, submitCouponForm, handleDeleteCoupon, handleToggleCouponStatus
- Module assignment: shell (coupons)

### reviews-handlers  --  lines 2263-2294
- Kind: handler
- Names: handleReviewStatus, handleDeleteReview
- Module assignment: shell (reviews)

### inventory-handler  --  lines 2296-2325
- Kind: handler
- Names: saveInventoryStock
- Module assignment: products (inventory)

### settings-handler  --  lines 2327-2375
- Kind: handler
- Names: savePaymentSettings
- Module assignment: shell (settings)
### categories-handler  --  lines 2377-2499
- Kind: handler
- Names: applySkincareCategoryPreset, handleDeleteCategory
- Module assignment: products (categories sub-module)
- Extraction note: applySkincareCategoryPreset calls productUpdateMutation to reassign products -- deep products+categories coupling.

### cms-handlers  --  lines 2501-2687
- Kind: handler
- Names: resetCmsEditor, openCreateCmsEditor, openEditCmsEditor, submitCmsForm, toggleCmsStatus, handleDeleteCmsPage, exportOrdersCsv, exportProductsCsv, exportCmsCsv
- Module assignment: shell (cms / orders export / products export)

### homepage-handler  --  lines 2688-2837
- Kind: handler
- Names: moveFeaturedCategory, saveHomepageContent
- Module assignment: dashboard-home (banners)
- Extraction note: Most mutation-dense handler. Calls settingsSetMutation + bannerCreate/Update + categoryUpdate in sequence.

### widget-drag-handlers  --  lines 2839-2864
- Kind: handler (DEAD CODE)
- Names: startWidgetDrag, dropWidget
- Module assignment: dashboard-home
- Extraction note: Never referenced in JSX. Delete, do not extract.

### products-columns  --  lines 2866-2952
- Kind: derived (column defs)
- Names: productColumns
- Module assignment: products

### orders-columns  --  lines 2954-3049
- Kind: derived (column defs)
- Names: orderColumns
- Module assignment: orders

### cms-columns  --  lines 3051-3168
- Kind: derived (column defs)
- Names: cmsColumns
- Module assignment: shell (cms)

### coupons-columns  --  lines 3170-3287
- Kind: derived (column defs)
- Names: couponColumns
- Module assignment: shell (coupons)

### reviews-columns  --  lines 3289-3448
- Kind: derived (column defs)
- Names: reviewColumns
- Dependencies: productRows (cell lookup for product name)
- Module assignment: shell (reviews)
- Extraction note: Embeds productRows.find() -- reviews reads products data.
### module-meta  --  lines 3450-3507
- Kind: derived (constant map)
- Names: moduleMeta
- Module assignment: shell

### auth-guard  --  lines 3509-3528
- Kind: jsx-block (early returns)
- Module assignment: shell

### shell-layout-jsx  --  lines 3532-3661
- Kind: jsx-block
- Names: gradient bg, motion.aside + SidebarNav (desktop), mobile Sheet + SidebarNav, TopBar
- Module assignment: shell
- Extraction note: TopBar onSearchSubmit (lines 3610-3656) calls setOrderSearch, setProductSearch, setCmsSearch across modules.

### page-header-actions-jsx  --  lines 3662-3776
- Kind: jsx-block
- Names: PageHeader with conditional actions prop switching on activeModule
- Module assignment: shell
- Extraction note: Keep in shell; each action callback is a prop from the active module component.

### analytics-reports-jsx  --  lines 3778-4347
- Kind: jsx-block
- Names: KPI grid, LineChart, PieChart, best sellers, low stock, failed payments, recent orders, top customers
- Module assignment: dashboard-home (~569 lines)
- Extraction note: Covers both analytics AND reports activeModule. Sub-split required: DashboardKPIs, DashboardCharts, DashboardTables.

### orders-jsx  --  lines 4349-4445
- Kind: jsx-block
- Module assignment: orders (~96 lines)

### products-jsx  --  lines 4447-4548
- Kind: jsx-block
- Module assignment: products (~101 lines)

### cms-jsx  --  lines 4551-4703
- Kind: jsx-block
- Module assignment: shell (cms, ~152 lines)

### banners-homepage-jsx  --  lines 4705-4994
- Kind: jsx-block
- Module assignment: dashboard-home (banners, ~289 lines)

### coupons-jsx  --  lines 4996-5043
- Kind: jsx-block
- Module assignment: shell (coupons, ~47 lines)

### reviews-jsx  --  lines 5046-5113
- Kind: jsx-block
- Module assignment: shell (reviews, ~67 lines)

### inventory-jsx  --  lines 5115-5316
- Kind: jsx-block
- Module assignment: products (inventory, ~201 lines)

### categories-jsx  --  lines 5318-5468
- Kind: jsx-block
- Module assignment: products (categories, ~150 lines)

### settings-jsx  --  lines 5470-5609
- Kind: jsx-block
- Module assignment: shell (settings, ~139 lines)

### product-dialogs-jsx  --  lines 5615-6608
- Kind: jsx-block
- Module assignment: products (~993 lines)
- Extraction note: MUST sub-split -- ProductFormDialog, ProductRoutineEditor (AM/PM tabs), ProductBulletEditor.

### coupon-dialogs-jsx  --  lines 6610-6834
- Kind: jsx-block
- Module assignment: shell (coupons, ~224 lines)

### cms-dialogs-jsx  --  lines 6836-7081
- Kind: jsx-block
- Module assignment: shell (cms, ~245 lines)

### reviews-dialog-jsx  --  lines 7083-7190
- Kind: jsx-block
- Module assignment: shell (reviews, ~107 lines)

### orders-dialog-jsx  --  lines 7192-7313
- Kind: jsx-block
- Module assignment: orders (~121 lines)

---
roductsQuery and categoriesQuery shared across 5+ modules: Both are enabled for products, inventory, categories, analytics, reports. Hoist to shell or create a shared query context.

2. invalidateProductSurface crosses into dashboard-home: Calls analytics.dashboard.invalidate() and queryClient.invalidateQueries([admin-analytics-overview]). Product mutations reach into dashboard-home query keys.

3. settingsSetMutation consumed by three modules: products (SEO fields in submitProductForm), banners (saveHomepageContent), and settings (savePaymentSettings) all call settingsSetMutation.mutateAsync.

4. dashboardNotifications calls setOrderStatusFilter from a click: The TopBar pending-orders notification sets orders module state from a dashboard-home-derived callback.

5. revenueTrend uses orderRows inside dashboard-home: Revenue trend chart derives from orderRows (orders module). Orders must extract before or alongside dashboard-home.

6. reviewColumns embeds productRows.find() in cell: Reviews column defs look up product names using productRows from the products query.

7. applySkincareCategoryPreset calls productUpdateMutation: Categories handler reassigns products by calling the products mutation.

8. saveHomepageContent calls categoryUpdateMutation: Homepage editor (dashboard-home/banners) updates category sort order using a products-owned mutation.

9. TopBar onSearchSubmit sets state in three modules: Lines 3610-3656 set orderSearch, productSearch, and cmsSearch depending on search keywords.

10. canManageProducts used as RBAC check for coupons and reviews: Coupon and review mutation handlers check canManageProducts even though they are not product operations.

---
## 4. JSX switch/conditional -- the render pane

The render pane at line 3662 uses if-then-null pattern (not a switch statement).

| activeModule value | JSX lines | Notes |
|--------------------|-----------|-------|
| analytics or reports | 3778-4347 | Shared block, both modules render same JSX |
| orders | 4349-4445 | DataTable + pagination |
| products | 4447-4548 | DataTable + filters |
| cms | 4551-4703 | Stat cards + DataTable |
| banners | 4705-4994 | Homepage editor (hero + promo + categories) |
| coupons | 4996-5043 | DataTable + filters |
| reviews | 5046-5113 | DataTable + filters |
| inventory | 5115-5316 | Stat cards + stock table |
| categories | 5318-5468 | Preset card + categories table |
| settings | 5470-5609 | Payment method switches |

Shell always-renders (regardless of activeModule):
- Outer gradient background div -- lines 3533-3535
- Desktop motion.aside + SidebarNav -- lines 3536-3555
- Mobile Sheet + SidebarNav -- lines 3558-3590
- TopBar -- lines 3592-3660
- PageHeader + conditional actions -- lines 3662-3776
- All Dialog overlays -- lines 5615-7313 (mounted regardless of active module)

---
## 5. Extraction order recommendation

Recommended order (adjusted from proposal):

1. Extract shared/ first -- ShimmerBlock, RetryPanel, formatters, csv, productHelpers, utils, types. Zero risk. All other modules depend on these. Also centralize settingsSetMutation into a useAdminMutations shell hook here.

2. Extract dashboard-home -- analytics/reports JSX (3778-4347) + banners/homepage editor (4705-4994). Pass invalidation callbacks as props from shell. Resolve revenueTrend/orderRows coupling by receiving orderRows as a prop.

3. Extract orders -- orders JSX (4349-4445) + order detail Dialog (7192-7313) + order column defs + order state/handlers. Simpler module, fewer cross-module refs.

4. Extract products -- products JSX (4447-4548) + inventory JSX (5115-5316) + categories JSX (5318-5468) + product form Dialog (5615-6608) + state/handlers. Largest module -- sub-split product Dialog first.

Flag: settingsSetMutation deeply shared -- do not attempt extracting settings before centralizing it in a shared hook (step 1).

---
## 6. Estimated line counts per target file

### shared/ (~465 lines total)
| File | Approx lines |
|------|-------------|
| shared/ShimmerBlock.tsx | ~15 |
| shared/RetryPanel.tsx | ~25 |
| shared/formatters.ts | ~40 |
| shared/csv.ts | ~35 |
| shared/utils.ts | ~65 |
| shared/productHelpers.ts | ~95 |
| shared/types.ts (entity types + form state types) | ~185 |

### dashboard-home/ (~1100 lines -- sub-split required)
| File | Approx lines |
|------|-------------|
| dashboard-home/index.tsx (orchestrator, state, effects, handlers) | ~250 |
| dashboard-home/DashboardKPIs.tsx (5-card KPI grid) | ~130 |
| dashboard-home/DashboardCharts.tsx (LineChart + PieChart) | ~220 |
| dashboard-home/DashboardTables.tsx (best sellers, low stock, failed payments, recent orders, top customers) | ~290 |
| dashboard-home/HomepageEditor.tsx (hero + promo + featured categories) | ~295 |

### orders/ (~400 lines)
| File | Approx lines |
|------|-------------|
| orders/index.tsx (orchestrator, state, queries, mutations, handlers) | ~200 |
| orders/OrdersTable.tsx (DataTable + pagination) | ~110 |
| orders/OrderDetailDialog.tsx | ~125 |

### products/ (~1700 lines -- sub-split required)
| File | Approx lines |
|------|-------------|
| products/index.tsx (orchestrator, state, queries, mutations, handlers) | ~350 |
| products/ProductsTable.tsx (DataTable + filters) | ~110 |
| products/ProductFormDialog.tsx (form fields: price, category, image, SEO, flags) | ~400 |
| products/ProductBulletEditor.tsx (benefits + descriptionBullets) | ~200 |
| products/ProductRoutineEditor.tsx (AM/PM tabs + step CRUD) | ~320 |
| products/InventoryTable.tsx (stat cards + editable table) | ~210 |
| products/CategoriesTable.tsx (categories table + preset card) | ~160 |

### shell (what stays in Admin.tsx after extraction)
Estimated remaining lines: ~600
Covers: auth guard, routing, sidebar, TopBar, PageHeader actions switch, permissions derivation, module orchestration wiring, remaining shell modules (cms, coupons, reviews, settings).

WARNING: products/ total is ~1700 lines -- sub-splitting is mandatory. The product Dialog JSX alone (lines 5615-6608) is 993 lines.