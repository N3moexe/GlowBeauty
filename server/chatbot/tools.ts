import * as db from "../db";
import * as store from "./store";

export type ProductToolResult = {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  url: string;
  inStock: boolean;
  description: string | null;
  category: string | null;
};

export async function searchProductsTool(
  query: string,
  filters?: {
    categoryId?: number;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  },
  limit = 6
): Promise<ProductToolResult[]> {
  const trimmedQuery = query.trim();
  const targetLimit = Math.max(1, Math.min(limit, 12));
  const [productsResult, categories] = await Promise.all([
    db.getProducts({
      search: trimmedQuery || undefined,
      categoryId: filters?.categoryId,
      limit: 120,
    }),
    db.getAllCategories(),
  ]);

  const categoryMap = new Map<number, string>();
  for (const item of categories || []) {
    categoryMap.set(Number((item as any).id), (item as any).name);
  }

  const rows = (productsResult.products || []) as any[];
  const filtered = rows
    .filter(item =>
      filters?.inStock === undefined ? true : Boolean(item.inStock) === filters.inStock
    )
    .filter(item =>
      filters?.minPrice === undefined ? true : Number(item.price || 0) >= filters.minPrice
    )
    .filter(item =>
      filters?.maxPrice === undefined ? true : Number(item.price || 0) <= filters.maxPrice
    )
    .slice(0, targetLimit)
    .map(item => ({
      id: Number(item.id),
      name: String(item.name || ""),
      price: Number(item.price || 0),
      imageUrl: item.imageUrl || null,
      url: `/produit/${encodeURIComponent(String(item.slug || ""))}`,
      inStock: Boolean(item.inStock),
      description: item.description || null,
      category: categoryMap.get(Number(item.categoryId)) || null,
    }));

  await store.logChatEvent({
    type: "product_search",
    payload: {
      query: trimmedQuery,
      resultCount: filtered.length,
    },
  });
  return filtered;
}

export async function getProductTool(productId: number): Promise<ProductToolResult | null> {
  const [product, categories] = await Promise.all([db.getProductById(productId), db.getAllCategories()]);
  if (!product) return null;
  const categoryName =
    (categories || []).find(item => Number((item as any).id) === Number((product as any).categoryId))
      ?.name || null;
  return {
    id: Number((product as any).id),
    name: String((product as any).name || ""),
    price: Number((product as any).price || 0),
    imageUrl: (product as any).imageUrl || null,
    url: `/produit/${encodeURIComponent(String((product as any).slug || ""))}`,
    inStock: Boolean((product as any).inStock),
    description: (product as any).description || null,
    category: categoryName,
  };
}

export async function getOrderStatusTool(phoneOrOrderId: string): Promise<{
  kind: "order";
  found: boolean;
  message: string;
  orders: Array<{
    id: number;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    totalAmount: number;
    customerPhone: string;
    createdAt: string;
  }>;
}> {
  const value = phoneOrOrderId.trim();
  if (!value) {
    return {
      kind: "order",
      found: false,
      message: "Merci de fournir un numero de commande ou un numero de telephone.",
      orders: [],
    };
  }

  const orderByNumber = await db.getOrderByNumber(value);
  if (orderByNumber) {
    return {
      kind: "order",
      found: true,
      message: "Commande retrouvee.",
      orders: [
        {
          id: Number((orderByNumber as any).id),
          orderNumber: String((orderByNumber as any).orderNumber || ""),
          status: String((orderByNumber as any).status || ""),
          paymentStatus: String((orderByNumber as any).paymentStatus || ""),
          totalAmount: Number((orderByNumber as any).totalAmount || 0),
          customerPhone: String((orderByNumber as any).customerPhone || ""),
          createdAt: new Date((orderByNumber as any).createdAt || Date.now()).toISOString(),
        },
      ],
    };
  }

  const byPhone = await store.findOrdersByPhone(value, 5);
  if (byPhone.length === 0) {
    return {
      kind: "order",
      found: false,
      message:
        "Aucune commande trouvee. Verifiez le numero ou ecrivez au support WhatsApp pour assistance.",
      orders: [],
    };
  }

  return {
    kind: "order",
    found: true,
    message: "Commandes associees a ce numero.",
    orders: byPhone.map((item: any) => ({
      id: Number(item.id),
      orderNumber: String(item.orderNumber || ""),
      status: String(item.status || ""),
      paymentStatus: String(item.paymentStatus || ""),
      totalAmount: Number(item.totalAmount || 0),
      customerPhone: String(item.customerPhone || ""),
      createdAt: new Date(item.createdAt || Date.now()).toISOString(),
    })),
  };
}

export async function getShippingOptionsTool(cityOrZone: string): Promise<{
  found: boolean;
  message: string;
  zones: Array<{
    id: number;
    name: string;
    slug: string;
    deliveryFee: number;
    deliveryDays: number;
    rates: Array<{
      id: number;
      label: string;
      minAmountCfa: number;
      maxAmountCfa: number | null;
      feeCfa: number;
      etaMinHours: number;
      etaMaxHours: number;
      isActive: boolean;
    }>;
  }>;
}> {
  const needle = cityOrZone.trim().toLowerCase();
  const zones = await db.getDeliveryZones();
  const matches = (zones || []).filter((zone: any) => {
    if (!needle) return true;
    const corpus = `${zone.name || ""} ${zone.slug || ""} ${zone.description || ""}`.toLowerCase();
    return corpus.includes(needle);
  });

  if (matches.length === 0) {
    return {
      found: false,
      message: "Aucune zone correspondante. Essayez Dakar, Pikine, Rufisque...",
      zones: [],
    };
  }

  const hydrated = await Promise.all(
    matches.slice(0, 5).map(async (zone: any) => ({
      id: Number(zone.id),
      name: String(zone.name || ""),
      slug: String(zone.slug || ""),
      deliveryFee: Number(zone.deliveryFee || 0),
      deliveryDays: Number(zone.deliveryDays || 0),
      rates: await db.listShippingRates(Number(zone.id)),
    }))
  );

  return {
    found: true,
    message: "Options de livraison disponibles.",
    zones: hydrated,
  };
}

export async function getFaqAnswerTool(query: string, locale = "fr-SN") {
  const article = await store.findBestKbAnswer(query, locale);
  if (!article) return null;
  return {
    id: article.id,
    title: article.title,
    answer: article.content,
    tags: article.tags,
    locale: article.locale,
  };
}

export async function createSupportTicketTool(input: {
  threadId: number;
  message: string;
  phone?: string;
}) {
  const ticket = await store.createSupportTicket(input);
  await store.logChatEvent({
    type: "ticket_created",
    threadId: input.threadId,
    payload: {
      ticketId: ticket.id,
      hasPhone: Boolean(ticket.phone),
    },
  });
  return ticket;
}
