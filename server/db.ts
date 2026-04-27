import {
  eq,
  like,
  and,
  desc,
  asc,
  sql,
  gte,
  lte,
  or,
  count,
  lt,
  inArray,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type {
  AdminChatbotSettings,
  AdminChatbotSettingsUpdate,
  AdminUser,
  AdminUserCreate,
  AdminUserRole,
  AuditLogItem,
  AuditLogListResponse,
  SettingsPayments,
  SettingsPaymentsUpdate,
  SettingsStore,
  SettingsStoreUpdate,
  ShippingRate,
  ShippingRateCreate,
  ShippingRateUpdate,
  ShippingZone,
  ShippingZoneCreate,
  ShippingZoneUpdate,
} from "@shared/admin-settings";
import type {
  AdminReviewsQuery,
  AdminReviewUpdateInput,
  ProductReviewItem,
  ProductReviewSummary,
  ReviewStatus,
} from "@shared/reviews";
import type {
  ProductContentFields,
  ProductRoutine,
  ProductRoutineStep,
} from "@shared/product-content";
import {
  MAX_PRODUCT_BULLETS,
  MAX_PRODUCT_DESCRIPTION_BULLETS,
  MAX_PRODUCT_ROUTINE_STEPS,
} from "@shared/product-content";
import {
  type InsertUser,
  type User,
  users,
  categories,
  products,
  orders,
  orderItems,
  pageViews,
  analyticsEvents,
  cmsResultsSection,
  cmsEditorialHero,
  deliveryZones,
  type DeliveryZone,
  reviews,
  reviewReplies,
  adminChatSettings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { normalizeEmail } from "./newsletter-utils";
import { safeJsonParse } from "./safe-json";

let _db: ReturnType<typeof drizzle> | null = null;

const demoCategories: any[] = [
  {
    id: 1,
    name: "Nettoyants",
    slug: "nettoyants",
    description: "Gels et huiles nettoyantes pour un nettoyage doux quotidien.",
    imageUrl: null,
    coverImageUrl: null,
    sortOrder: 1,
    createdAt: new Date(),
  },
  {
    id: 2,
    name: "Serums",
    slug: "serums",
    description:
      "Actifs cibles: hydratation, eclat, imperfections et anti-age.",
    imageUrl: null,
    coverImageUrl: null,
    sortOrder: 2,
    createdAt: new Date(),
  },
  {
    id: 3,
    name: "Hydratants",
    slug: "hydratants",
    description: "Cremes et lotions pour renforcer la barriere cutanee.",
    imageUrl: null,
    coverImageUrl: null,
    sortOrder: 3,
    createdAt: new Date(),
  },
  {
    id: 4,
    name: "Masques",
    slug: "masques",
    description: "Masques hebdomadaires pour detox, glow et nutrition intense.",
    imageUrl: null,
    coverImageUrl: null,
    sortOrder: 4,
    createdAt: new Date(),
  },
  {
    id: 5,
    name: "SPF",
    slug: "spf",
    description: "Protections solaires quotidiennes large spectre.",
    imageUrl: null,
    coverImageUrl: null,
    sortOrder: 5,
    createdAt: new Date(),
  },
  {
    id: 6,
    name: "Kits Routine",
    slug: "kits-routine",
    description: "Routines pre-composees matin/soir par objectif peau.",
    imageUrl: null,
    coverImageUrl: null,
    sortOrder: 6,
    createdAt: new Date(),
  },
];

const demoProducts: any[] = [
  // Nettoyants (category 1)
  {
    id: 1,
    name: "Gel Nettoyant Doux Aloe",
    slug: "gel-nettoyant-doux-aloe",
    description:
      "Nettoie sans agresser\nAloe + glycérine, pH équilibré\nConvient peaux sensibles",
    price: 9900,
    comparePrice: 12900,
    categoryId: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 48,
    isFeatured: true,
    isNew: true,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    benefits: [
      "Nettoie en profondeur sans dessécher la peau",
      "Respecte le film hydrolipidique grâce à un pH équilibré à 5.5",
      "Apaise les peaux réactives avec l'aloe vera bio",
      "Prépare la peau à absorber les sérums et hydratants",
    ],
    descriptionBullets: [
      "Aloe vera bio du Sénégal — apaise et hydrate dès le nettoyage",
      "Glycérine végétale pour maintenir l'hydratation après rinçage",
      "Sans savon, sans parfum, sans sulfates agressifs",
      "Texture gel-mousse, rinçage propre et sensation de fraîcheur",
    ],
    routine: {
      am: [
        {
          title: "Nettoyer",
          text: "Masser sur peau humide, rincer à l'eau tiède.",
        },
        {
          title: "Tonifier ou hydrater",
          text: "Appliquer immédiatement un sérum ou une lotion pour verrouiller l'hydratation.",
        },
      ],
      pm: [
        {
          title: "Double nettoyage",
          text: "Après un démaquillant huile, utiliser ce gel pour retirer les dernières impuretés.",
        },
        {
          title: "Routine traitement",
          text: "Enchaîner avec sérum ciblé puis crème hydratante.",
        },
      ],
    },
  },
  {
    id: 2,
    name: "Huile Démaquillante Moringa",
    slug: "huile-demaquillante-moringa",
    description:
      "Retire maquillage et SPF\nHuile de moringa bio\nS'émulsionne à l'eau",
    price: 12900,
    comparePrice: 15900,
    categoryId: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 3,
    isFeatured: false,
    isNew: true,
    isTrending: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    benefits: [
      "Dissout maquillage waterproof et crème solaire en un seul geste",
      "Nourrit la peau pendant le nettoyage — pas d'effet tiraillé",
      "S'émulsionne à l'eau pour un rinçage propre, sans film gras",
      "Première étape du double nettoyage soir recommandé",
    ],
    descriptionBullets: [
      "Huile de moringa bio — riche en antioxydants, légère sur la peau",
      "Mélange d'huiles végétales non comédogènes",
      "Formule sans parfum, adaptée aux yeux sensibles et aux peaux fragiles",
      "Flacon pompe 150 ml — dosage précis sans gaspillage",
    ],
    routine: {
      am: [
        {
          title: "Optionnel le matin",
          text: "Pour les peaux très sèches, un passage rapide avant le gel nettoyant suffit.",
        },
      ],
      pm: [
        {
          title: "Appliquer sur peau sèche",
          text: "Masser 30 secondes pour dissoudre maquillage et SPF.",
        },
        {
          title: "Émulsionner à l'eau",
          text: "Ajouter de l'eau tiède, masser jusqu'à obtenir un lait, rincer.",
        },
        {
          title: "Second nettoyage",
          text: "Enchaîner avec un gel nettoyant doux pour une peau parfaitement propre.",
        },
      ],
    },
  },
  // Sérums (category 2)
  {
    id: 3,
    name: "Sérum Vitamine C 15%",
    slug: "serum-vitamine-c-15",
    description:
      "Éclat et unification du teint\nAcide L-ascorbique 15% + Vit E\nFormule stabilisée, flacon ambré",
    price: 19900,
    comparePrice: 24900,
    categoryId: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 40,
    isFeatured: true,
    isNew: true,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    benefits: [
      "Éclaircit progressivement les taches pigmentaires",
      "Ravive l'éclat du teint dès 2 semaines d'application",
      "Neutralise les radicaux libres liés au soleil et à la pollution",
      "Stimule la production naturelle de collagène",
    ],
    descriptionBullets: [
      "Acide L-ascorbique 15 %, la forme la plus étudiée de la vitamine C",
      "Vitamine E et acide férulique pour stabiliser et démultiplier l'effet",
      "Flacon ambré opaque pour préserver la formule de la lumière",
      "Texture fluide, sans parfum, convient aux peaux normales à mixtes",
    ],
    routine: {
      am: [
        {
          title: "Nettoyage doux",
          text: "Appliquer sur peau nettoyée et sèche.",
        },
        {
          title: "Sérum Vitamine C (3-4 gouttes)",
          text: "Chauffer entre les mains, presser délicatement sur le visage.",
        },
        {
          title: "Hydratant + SPF 50",
          text: "Toujours terminer par une protection solaire, la vitamine C sensibilise la peau.",
        },
      ],
      pm: [
        {
          title: "Éviter les mélanges",
          text: "Ne pas superposer avec du rétinol ou des AHA le même soir.",
        },
      ],
    },
  },
  {
    id: 4,
    name: "Sérum Acide Hyaluronique",
    slug: "serum-acide-hyaluronique",
    description:
      "Hydratation profonde longue durée\n3 poids moléculaires, effet repulpant\nTextures aqueuse, pénétration rapide",
    price: 17900,
    comparePrice: 21900,
    categoryId: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1571781565036-d3f759be73e4?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 55,
    isFeatured: true,
    isNew: false,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    benefits: [
      "Hydratation continue pendant 24 heures",
      "Lisse visiblement les ridules de déshydratation",
      "Repulpe la peau sans alourdir la texture",
      "Apaise les tiraillements après le soleil ou la climatisation",
    ],
    descriptionBullets: [
      "Trois poids moléculaires d'acide hyaluronique pour une hydratation en profondeur",
      "Extrait d'aloès vera bio pour l'effet apaisant",
      "Texture aqueuse ultra-légère, aucune sensation collante",
      "Compatible avec toutes les routines (matin et soir)",
    ],
    routine: {
      am: [
        {
          title: "Sur peau légèrement humide",
          text: "Après le nettoyant, vaporiser une brume ou laisser quelques gouttes d'eau.",
        },
        {
          title: "Sérum Acide Hyaluronique",
          text: "Appliquer 4-5 gouttes en tapotant jusqu'à absorption.",
        },
        {
          title: "Sceller avec la crème",
          text: "Une crème hydratante au-dessus emprisonne l'eau dans la peau.",
        },
      ],
      pm: [
        {
          title: "Même geste qu'au matin",
          text: "L'acide hyaluronique se superpose à presque tout — actifs, huiles, masques.",
        },
      ],
    },
  },
  {
    id: 5,
    name: "Sérum Niacinamide 10%",
    slug: "serum-niacinamide-10",
    description:
      "Réduit pores et imperfections\nNiacinamide 10% + zinc\nÉquilibre le sébum, sans alcool",
    price: 15900,
    comparePrice: 19900,
    categoryId: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 44,
    isFeatured: false,
    isNew: true,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    benefits: [
      "Resserre visiblement les pores dilatés en 4 semaines",
      "Régule la production de sébum pour un teint plus mat",
      "Atténue les marques post-acné et unifie le teint",
      "Renforce la barrière cutanée — moins de sensibilité",
    ],
    descriptionBullets: [
      "Niacinamide 10 % — dosage clinique, efficace dès 4 semaines",
      "Zinc PCA pour moduler la production de sébum",
      "Base aqueuse sans alcool, sans parfum, pH 5.5",
      "Texture fluide qui disparaît sans film collant",
    ],
    routine: {
      am: [
        {
          title: "Après le sérum vitamine C",
          text: "Appliquer 3-4 gouttes sur l'ensemble du visage.",
        },
        {
          title: "Hydratant + SPF",
          text: "Verrouiller avec une crème hydratante puis une protection solaire.",
        },
      ],
      pm: [
        {
          title: "Sur peau nettoyée",
          text: "Appliquer avant les actifs exfoliants ou le rétinol.",
        },
        {
          title: "Compatible avec (presque) tout",
          text: "Se marie bien avec acide hyaluronique, céramides, rétinol. Éviter la superposition avec la vitamine C pure.",
        },
      ],
    },
  },
  // Hydratants (category 3)
  {
    id: 6,
    name: "Crème Hydratante Céramides",
    slug: "creme-hydratante-ceramides",
    description:
      "Restaure la barrière cutanée\nCéramides + beurre de karité\nFormule non comédogène",
    price: 14900,
    comparePrice: 18900,
    categoryId: 3,
    imageUrl:
      "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 60,
    isFeatured: true,
    isNew: false,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    benefits: [
      "Reconstitue la barrière cutanée en 4 à 6 semaines",
      "Apaise les peaux sèches, sensibles ou sujettes à tiraillements",
      "Hydrate sans effet gras, laisse un fini velouté",
      "Convient aux peaux réactives et post-traitement dermatologique",
    ],
    descriptionBullets: [
      "Complexe de 3 céramides identiques à ceux de la peau (1, 3 et 6-II)",
      "Beurre de karité non raffiné du Burkina, extrait à froid",
      "Glycérine végétale et squalane d'olive pour l'hydratation immédiate",
      "Sans parfum, sans alcool, non comédogène",
    ],
    routine: {
      am: [
        {
          title: "Après vos sérums",
          text: "Prélever une noisette, réchauffer entre les paumes.",
        },
        {
          title: "Application ascendante",
          text: "Appliquer en mouvements doux du cou vers le front.",
        },
      ],
      pm: [
        {
          title: "Couche plus généreuse",
          text: "Le soir, ne pas hésiter à doubler la quantité pour un effet masque de nuit.",
        },
      ],
    },
  },
  {
    id: 7,
    name: "Baume Lèvres Karité",
    slug: "baume-levres-karite",
    description:
      "Nourrit et répare les lèvres\nKarité brut + huile de coco\nPetit format, sans parfum",
    price: 4900,
    comparePrice: 6900,
    categoryId: 3,
    imageUrl:
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 80,
    isFeatured: false,
    isNew: false,
    isTrending: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Masques (category 4)
  {
    id: 8,
    name: "Masque Argile Détox",
    slug: "masque-argile-detox",
    description:
      "Purifie les pores congestionnés\nArgile verte + charbon actif\nUsage 1-2 fois par semaine",
    price: 10900,
    comparePrice: 13900,
    categoryId: 4,
    imageUrl:
      "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 38,
    isFeatured: false,
    isNew: true,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 9,
    name: "Masque Nuit Repulpant",
    slug: "masque-nuit-repulpant",
    description:
      "Soin overnight hydratation intense\nAcide hyaluronique + extrait riz\nSe rince au matin",
    price: 13900,
    comparePrice: 17900,
    categoryId: 4,
    imageUrl:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 28,
    isFeatured: true,
    isNew: true,
    isTrending: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // SPF (category 5)
  {
    id: 10,
    name: "SPF 50+ Fluide Invisible",
    slug: "spf-50-fluide-invisible",
    description:
      "Protection quotidienne haute\nSPF 50+ PA++++, filtres minéraux\nFini invisible, sans white cast",
    price: 16900,
    comparePrice: 21900,
    categoryId: 5,
    imageUrl:
      "https://images.unsplash.com/photo-1556228841-a3c527ebefe5?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 50,
    isFeatured: true,
    isNew: true,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    benefits: [
      "Protège des UVB, UVA et de la lumière bleue du quotidien",
      "Fini invisible et non gras, même sur carnations foncées",
      "Prévient les taches pigmentaires et le vieillissement prématuré",
      "Résistant à l'eau et à la transpiration jusqu'à 40 minutes",
    ],
    descriptionBullets: [
      "SPF 50+ PA++++, indice maximum officiel",
      "Filtres minéraux microfins (oxyde de zinc + dioxyde de titane)",
      "Zéro trace blanche, se fond dans toutes les carnations",
      "Convient comme base de maquillage, ne pèle pas, ne sèche pas",
    ],
    routine: {
      am: [
        {
          title: "Dernière étape du matin",
          text: "Après hydratation, appliquer la valeur de deux doigts sur le visage et le cou.",
        },
        {
          title: "Réappliquer dans la journée",
          text: "Toutes les 2 heures en cas d'exposition directe, ou après la piscine.",
        },
      ],
      pm: [
        {
          title: "Non utilisé le soir",
          text: "Les filtres solaires ne sont pas nécessaires la nuit — priorisez sérum et crème.",
        },
      ],
    },
  },
  {
    id: 11,
    name: "SPF 30 Teinté Universel",
    slug: "spf-30-teinte-universel",
    description:
      "Protection + unification teint\nSPF 30 + pigments universels\nConvient carnations foncées",
    price: 14900,
    comparePrice: 18900,
    categoryId: 5,
    imageUrl:
      "https://images.unsplash.com/photo-1631730486572-226d1f595b68?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 35,
    isFeatured: false,
    isNew: false,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Kits Routine (category 6)
  {
    id: 12,
    name: "Kit Routine Glow Complet",
    slug: "kit-routine-glow-complet",
    description:
      "Routine matin + soir éclat\nGel nettoyant + Vit C + SPF\nIdéal peaux ternes",
    price: 42900,
    comparePrice: 54900,
    categoryId: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 18,
    isFeatured: true,
    isNew: true,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 13,
    name: "Kit Routine Peau Sensible",
    slug: "kit-routine-peau-sensible",
    description:
      "Nettoyage doux + hydratation\nGel aloe + crème céramides + SPF\nSans parfum ni alcool",
    price: 38900,
    comparePrice: 49900,
    categoryId: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 22,
    isFeatured: true,
    isNew: false,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 14,
    name: "Kit Anti-Imperfections",
    slug: "kit-anti-imperfections",
    description:
      "Contrôle sébum et pores\nNettoyant + niacinamide + masque argile\nUsage quotidien",
    price: 35900,
    comparePrice: 45900,
    categoryId: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1601049413041-e7a6a76a65f6?w=900&q=80",
    images: null,
    inStock: true,
    stockQuantity: 26,
    isFeatured: false,
    isNew: true,
    isTrending: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const demoDeliveryZones: DeliveryZone[] = [
  {
    id: 1,
    name: "Dakar Centre",
    slug: "dakar-centre",
    description: "Plateau, Medina, Point E",
    deliveryFee: 2000,
    deliveryDays: 1,
    isActive: true,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: "Banlieue de Dakar",
    slug: "banlieue-dakar",
    description: "Pikine, Guediawaye, Rufisque",
    deliveryFee: 3000,
    deliveryDays: 2,
    isActive: true,
    displayOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    name: "Region de Dakar",
    slug: "region-dakar",
    description: "Rufisque, Bargny et environs",
    deliveryFee: 5000,
    deliveryDays: 2,
    isActive: true,
    displayOrder: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let demoShippingRateIdSeq = 4;
const demoShippingRates: Array<{
  id: number;
  zoneId: number;
  label: string;
  minAmountCfa: number;
  maxAmountCfa: number | null;
  feeCfa: number;
  etaMinHours: number;
  etaMaxHours: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = [
  {
    id: 1,
    zoneId: 1,
    label: "Dakar 24h",
    minAmountCfa: 0,
    maxAmountCfa: null,
    feeCfa: 2000,
    etaMinHours: 24,
    etaMaxHours: 36,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    zoneId: 2,
    label: "Banlieue 24-48h",
    minAmountCfa: 0,
    maxAmountCfa: null,
    feeCfa: 3000,
    etaMinHours: 24,
    etaMaxHours: 48,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    zoneId: 3,
    label: "Regions 48-72h",
    minAmountCfa: 0,
    maxAmountCfa: null,
    feeCfa: 5000,
    etaMinHours: 48,
    etaMaxHours: 72,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let demoAuditLogIdSeq = 1;
const demoAuditLogs: AuditLogItem[] = [];

let demoOrderIdSeq = 1;
let demoOrderItemIdSeq = 1;
const demoOrders: any[] = [];
const demoOrderItems: any[] = [];
const demoPageViews: Array<{
  page: string;
  visitorId: string;
  sessionId?: string;
  referrer?: string;
  userAgent?: string;
  createdAt: Date;
}> = [];
let demoAnalyticsEventIdSeq = 1;
const demoAnalyticsEvents: Array<{
  id: number;
  type: "page_view" | "add_to_cart" | "checkout_start" | "purchase";
  sessionId: string;
  userId: number | null;
  path: string;
  meta: string | null;
  createdAt: Date;
}> = [];
let demoReviewIdSeq = 1;
const demoProductReviews: Array<{
  id: number;
  productId: number;
  orderId: number | null;
  customerName: string;
  customerEmail: string | null;
  rating: number;
  title: string | null;
  body: string;
  images: string[];
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = [];
let demoReviewReplyIdSeq = 1;
const demoReviewReplies: Array<{
  id: number;
  reviewId: number;
  adminUserId: number | null;
  body: string;
  createdAt: Date;
}> = [];

let demoCouponIdSeq = 3;
const demoCoupons: Array<{
  id: number;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount: number;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = [
  {
    id: 1,
    code: "WELCOME10",
    description: "10% off first order",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 10000,
    maxUses: 500,
    currentUses: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    code: "SKINCARE5000",
    description: "5000 CFA off premium kits",
    discountType: "fixed",
    discountValue: 5000,
    minOrderAmount: 45000,
    maxUses: 250,
    currentUses: 0,
    isActive: true,
    startDate: null,
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let demoCmsPageIdSeq = 2;
const demoCmsPages: Array<{
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
  createdAt: Date;
}> = [
  {
    id: 1,
    title: "Accueil",
    slug: "accueil",
    status: "published",
    content: "Contenu de demonstration pour la page d'accueil.",
    seoTitle: "SenBonsPlans - Accueil",
    seoDescription: "Page CMS de demonstration.",
    updatedAt: new Date(),
    createdAt: new Date(),
  },
];
const demoStoreSettings = new Map<string, string>([
  ["store.name", "SenBonsPlans"],
  ["store.contact", "+221 78 891 10 10"],
  ["store.email", "contact@senbonsplans.com"],
  ["store.address", "Dakar, Senegal"],
  ["store.currency", "CFA"],
  ["store.deliveryText", "Expedition a Dakar et regions en 24h/72h."],
  [
    "store.paymentMethodsText",
    "Wave, Orange Money, Free Money, Visa, Mastercard",
  ],
  ["promo.active", "true"],
  ["promo.kicker", "Promo de la semaine"],
  ["promo.title", "Jusqu'a -40% sur une selection premium"],
  [
    "promo.subtitle",
    "Activez les offres exclusives et augmentez le panier moyen avec des produits tendance.",
  ],
  ["promo.linkLabel", "Voir les promotions"],
  ["promo.linkHref", "/boutique"],
  ["payments.waveEnabled", "true"],
  ["payments.orangeEnabled", "true"],
  ["payments.freeMoneyEnabled", "true"],
  ["payments.cardEnabled", "false"],
]);

const defaultAdminChatbotSettings: AdminChatbotSettings = {
  id: 1,
  greeting:
    "Bienvenue chez SenBonsPlans. Je suis votre concierge skincare premium.",
  tone: "Luxury skincare",
  whatsappNumber: "+221788911010",
  policies: {
    return: "Retours acceptes selon etat du produit sous validation support.",
    delivery: "Livraison a Dakar et regions selon zone et delai.",
    payment:
      "Paiement Wave, Orange Money, Free Money, carte selon disponibilite.",
  },
  updatedAt: new Date().toISOString(),
};

let demoAdminChatbotSettings: AdminChatbotSettings = {
  ...defaultAdminChatbotSettings,
};

const defaultCmsResultsSectionSeed = {
  enabled: true,
  title: "Des routines pensees pour des resultats visibles",
  subtitle:
    "Notre composition associe actifs performants, textures agreables et protocoles simples.",
  beforeLabel: "AVANT",
  afterLabel: "APRES",
  beforeImageUrl: null as string | null,
  afterImageUrl: null as string | null,
  stat1Value: "+42%",
  stat1Title: "Hydratation",
  stat1Desc: "Confort percu apres 28 jours d'utilisation reguliere.",
  stat2Value: "-37%",
  stat2Title: "Imperfections visibles",
  stat2Desc: "Routine niacinamide + nettoyant doux chez nos clientes test.",
  stat3Value: "+Glow",
  stat3Title: "Uniformite du teint",
  stat3Desc: "Association vitamine C + SPF pour prevenir les marques.",
  footerNote:
    "Dermatologiquement testee. Actifs references: niacinamide, acide hyaluronique, ceramides et SPF.",
};

let demoCmsResultsSectionRow = {
  id: 1,
  ...defaultCmsResultsSectionSeed,
  updatedAt: new Date(),
};

const defaultCmsEditorialHeroSeed: {
  id: number;
  isActive: boolean;
  badgeText: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  backgroundImageUrl: string;
  overlayOpacity: number;
  cardPosition: "left" | "center" | "right";
} = {
  id: 1,
  isActive: true,
  badgeText: "RITUEL SIGNATURE",
  title: "Un rituel skincare elegant, pense pour votre peau.",
  subtitle:
    "Des actifs premium, une routine simple et des resultats visibles, jour apres jour.",
  ctaText: "Decouvrir la routine",
  ctaLink: "/boutique",
  backgroundImageUrl: "",
  overlayOpacity: 55,
  cardPosition: "left",
};

let demoCmsEditorialHeroRow = {
  ...defaultCmsEditorialHeroSeed,
  updatedAt: new Date(),
};

type NewsletterSubscriberStatus = "PENDING" | "SUBSCRIBED" | "UNSUBSCRIBED";
type NewsletterSubscriberRecord = {
  id: string;
  email: string;
  status: NewsletterSubscriberStatus;
  source: string | null;
  locale: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  unsubscribedAt: Date | null;
  confirmationToken: string | null;
  confirmationTokenExpiresAt: Date | null;
  confirmedAt: Date | null;
};

const demoNewsletterSubscribers: NewsletterSubscriberRecord[] = [];

export function __resetDemoNewsletterForTests() {
  demoNewsletterSubscribers.length = 0;
}

const NEWSLETTER_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function generateConfirmationToken() {
  // 32+ char url-safe random token.
  if (typeof crypto.randomUUID === "function") {
    return `${crypto.randomUUID().replace(/-/g, "")}${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2)}${Math.random().toString(36).slice(2)}`;
}

export type AdminRole = "ADMIN" | "MANAGER" | "STAFF";

function mapStaffRoleToAdminRole(role: string | null | undefined): AdminRole {
  if (!role) return "STAFF";
  if (role === "owner") return "ADMIN";
  if (role === "manager") return "MANAGER";
  return "STAFF";
}

function mapAdminRoleToUserRole(role: AdminRole): AdminUserRole {
  if (role === "ADMIN") return "admin";
  if (role === "MANAGER") return "manager";
  return "editor";
}

function mapUserRoleToAdminRole(role: AdminUserRole): AdminRole {
  if (role === "admin") return "ADMIN";
  if (role === "manager") return "MANAGER";
  return "STAFF";
}

type DemoAdminUserEntry = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  role: AdminRole;
  isActive: boolean;
  loginMethod: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
};

let demoAdminUserIdSeq = 3;
const demoAdminUsers: DemoAdminUserEntry[] = [
  {
    id: 1,
    name: "Admin Local",
    email: "admin@senbonsplans.local",
    phone: null,
    username: "admin",
    role: "ADMIN",
    isActive: true,
    loginMethod: "local_admin",
    createdAt: new Date(),
    lastLoginAt: new Date(),
  },
  {
    id: 2,
    name: "Manager Demo",
    email: "manager@senbonsplans.local",
    phone: null,
    username: "manager",
    role: "MANAGER",
    isActive: true,
    loginMethod: "local_admin",
    createdAt: new Date(),
    lastLoginAt: null,
  },
];

const demoAdminPasswordHashes = new Map<number, string>();

// ─── Demo dashboard seed ───
// Populates the in-memory arrays with realistic orders, reviews, and analytics
// so the /admin dashboard renders meaningful data when running without a DB.
// Only runs in demo mode (no DATABASE_URL); real DB queries never read these.
(function seedDemoDashboard() {
  if (process.env.DATABASE_URL) return;

  // Drop stock on three products so the "Low stock alerts" widget populates.
  const lowStockIds = [9, 12, 14];
  for (const id of lowStockIds) {
    const product = demoProducts.find(entry => entry.id === id);
    if (product) product.stockQuantity = [3, 5, 7][lowStockIds.indexOf(id)];
  }

  const firstNames = [
    "Aïssatou",
    "Mariama",
    "Fatou",
    "Awa",
    "Khady",
    "Bineta",
    "Ndeye",
    "Aminata",
    "Mame Diarra",
    "Adji",
    "Coumba",
    "Rokhaya",
    "Sokhna",
    "Oumy",
    "Ndella",
    "Astou",
    "Penda",
    "Seynabou",
    "Maty",
    "Anta",
  ];
  const lastNames = [
    "Diop",
    "Ndiaye",
    "Fall",
    "Sarr",
    "Sow",
    "Ba",
    "Cissé",
    "Gueye",
    "Kane",
    "Mbaye",
    "Diouf",
    "Seck",
    "Faye",
    "Sy",
    "Diagne",
    "Thiam",
  ];
  const cities = [
    "Dakar",
    "Thiès",
    "Saint-Louis",
    "Rufisque",
    "Pikine",
    "Guédiawaye",
    "Mbour",
  ];
  const paymentMethods = ["wave", "orange_money", "free_money", "card"];
  const statusWeights: Array<[string, number]> = [
    ["delivered", 0.55],
    ["shipped", 0.18],
    ["confirmed", 0.12],
    ["pending", 0.08],
    ["cancelled", 0.07],
  ];
  const paymentStatusByOrderStatus: Record<string, string> = {
    delivered: "paid",
    shipped: "paid",
    confirmed: "paid",
    pending: "pending",
    cancelled: "refunded",
  };

  let seedRng = 1337;
  const rand = () => {
    seedRng = (seedRng * 1664525 + 1013904223) >>> 0;
    return seedRng / 0x100000000;
  };
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const pickWeighted = (entries: Array<[string, number]>): string => {
    const roll = rand();
    let acc = 0;
    for (const [value, weight] of entries) {
      acc += weight;
      if (roll <= acc) return value;
    }
    return entries[entries.length - 1][0];
  };

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  for (let i = 0; i < 48; i++) {
    const dayOffset = Math.floor(rand() * 30);
    const hourOffset = Math.floor(rand() * 24);
    const createdAt = new Date(
      now - dayOffset * DAY - hourOffset * 60 * 60 * 1000
    );

    // Pick 1-3 products per order.
    const itemCount = 1 + Math.floor(rand() * 3);
    const picked: any[] = [];
    const seen = new Set<number>();
    while (picked.length < itemCount && seen.size < demoProducts.length) {
      const product = pick(demoProducts);
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      const quantity = 1 + Math.floor(rand() * 2);
      picked.push({
        productId: product.id,
        productName: product.name,
        productImage: product.imageUrl,
        quantity,
        unitPrice: product.price,
        totalPrice: product.price * quantity,
      });
    }

    const subtotal = picked.reduce((sum, item) => sum + item.totalPrice, 0);
    const shippingFee = subtotal >= 50000 ? 0 : 2500;
    const total = subtotal + shippingFee;

    // ~6% of orders fail payment — surfaces the "Failed payments" widget.
    const failed = rand() < 0.06;
    const orderStatus = failed ? "cancelled" : pickWeighted(statusWeights);
    const paymentStatus = failed
      ? "failed"
      : (paymentStatusByOrderStatus[orderStatus] ?? "pending");

    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const city = pick(cities);
    const orderId = demoOrderIdSeq++;

    demoOrders.push({
      id: orderId,
      orderNumber: `SBP-${String(20000 + orderId).padStart(5, "0")}`,
      customerName: `${firstName} ${lastName}`,
      customerPhone: `+2217${70 + Math.floor(rand() * 10)}${String(Math.floor(rand() * 1_000_000)).padStart(6, "0")}`,
      customerAddress: `${Math.floor(rand() * 200) + 1} Rue ${Math.floor(rand() * 50) + 1}, ${city}`,
      customerCity: city,
      subtotalAmount: subtotal,
      shippingFee,
      couponCode: rand() < 0.12 ? "WELCOME10" : null,
      discountAmount: 0,
      discountType: null,
      totalAmount: total,
      totalPaid: paymentStatus === "paid" ? total : 0,
      paymentMethod: pick(paymentMethods),
      paymentReference: null,
      status: orderStatus,
      paymentStatus,
      createdAt,
      updatedAt: createdAt,
    });

    for (const item of picked) {
      demoOrderItems.push({
        id: demoOrderItemIdSeq++,
        orderId,
        ...item,
      });
    }
  }

  // Analytics events for the conversion rate KPI.
  // ~900 page views and ~40 purchases → ~4.4% — realistic for a cosmetics store.
  for (let i = 0; i < 900; i++) {
    demoAnalyticsEvents.push({
      id: demoAnalyticsEventIdSeq++,
      type: "page_view",
      sessionId: `session-${Math.floor(rand() * 400)}`,
      userId: null,
      path: pick([
        "/",
        "/boutique",
        "/boutique/serum-vitamine-c-15",
        "/boutique/spf-50-fluide-invisible",
        "/panier",
        "/suivi",
      ]),
      meta: null,
      createdAt: new Date(now - Math.floor(rand() * 30 * DAY)),
    });
  }
  for (let i = 0; i < 42; i++) {
    demoAnalyticsEvents.push({
      id: demoAnalyticsEventIdSeq++,
      type: "purchase",
      sessionId: `session-${Math.floor(rand() * 400)}`,
      userId: null,
      path: "/checkout/success",
      meta: null,
      createdAt: new Date(now - Math.floor(rand() * 30 * DAY)),
    });
  }

  // A handful of published reviews so the Reviews module lights up.
  const reviewSeed = [
    {
      productId: 3,
      rating: 5,
      title: "Effet visible en 3 semaines",
      body: "Mon teint est plus lumineux, les taches s'estompent.",
    },
    {
      productId: 4,
      rating: 5,
      title: "Coup de cœur",
      body: "Peau hydratée toute la journée, je recommande.",
    },
    {
      productId: 6,
      rating: 4,
      title: "Très bien",
      body: "Texture agréable, absorbe rapidement.",
    },
    {
      productId: 10,
      rating: 5,
      title: "Le meilleur SPF",
      body: "Pas de white cast, parfait pour ma peau.",
    },
    {
      productId: 12,
      rating: 5,
      title: "Kit complet",
      body: "Tout ce qu'il faut pour commencer une routine.",
    },
    {
      productId: 5,
      rating: 4,
      title: "Bon produit",
      body: "J'aime l'effet matifiant, réduit les pores.",
    },
  ];
  for (const seed of reviewSeed) {
    const createdAt = new Date(now - Math.floor(rand() * 20 * DAY));
    demoProductReviews.push({
      id: demoReviewIdSeq++,
      productId: seed.productId,
      orderId: null,
      customerName: `${pick(firstNames)} ${pick(lastNames)}`,
      customerEmail: null,
      rating: seed.rating,
      title: seed.title,
      body: seed.body,
      images: [],
      status: "approved",
      isVerifiedPurchase: true,
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Activity log entries for the admin Activity widget.
  const auditSeed: Array<{
    action: string;
    entityType: string;
    after: Record<string, unknown>;
  }> = [
    {
      action: "order.paid",
      entityType: "order",
      after: { note: "Wave payment captured" },
    },
    {
      action: "product.updated",
      entityType: "product",
      after: { note: "Prix mis à jour" },
    },
    {
      action: "coupon.created",
      entityType: "coupon",
      after: { code: "WELCOME10" },
    },
    {
      action: "storefront.layout.updated",
      entityType: "storefront",
      after: { note: "Section hero éditée" },
    },
    {
      action: "review.approved",
      entityType: "review",
      after: { product: "Sérum Vitamine C" },
    },
    {
      action: "inventory.adjusted",
      entityType: "product",
      after: { delta: 20 },
    },
  ];
  for (const entry of auditSeed) {
    const createdAt = new Date(now - Math.floor(rand() * 5 * DAY));
    demoAuditLogs.push({
      id: demoAuditLogIdSeq++,
      actorUserId: 1,
      actorName: "Admin Local",
      action: entry.action,
      entityType: entry.entityType,
      entityId: null,
      beforeJson: null,
      afterJson: entry.after,
      ip: null,
      userAgent: null,
      createdAt: createdAt.toISOString(),
    });
  }
})();

function normalizeOptionalText(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSettingsBoolean(
  value: string | null | undefined,
  fallback: boolean
) {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseJsonObject(
  value: string | null | undefined
): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const output: Record<string, string> = {};
    for (const [key, entryValue] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (key.trim().length === 0 || typeof entryValue !== "string") continue;
      output[key.trim()] = entryValue.trim();
    }
    return output;
  } catch {
    return {};
  }
}

function slugifyZoneName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 255);
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ───
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0)
      updateSet.lastSignedIn = new Date();
    await db
      .insert(users)
      .values(values)
      .onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getEffectiveAdminRole(
  user: Pick<User, "id" | "role"> | null | undefined
): Promise<AdminRole | null> {
  if (!user) return null;

  const db = await getDb();
  if (!db) {
    return user.role === "admin" ? "ADMIN" : null;
  }

  const { staffAccounts: staffAccountsTable } =
    await import("../drizzle/schema");
  const result = await db
    .select()
    .from(staffAccountsTable)
    .where(eq(staffAccountsTable.userId, user.id))
    .orderBy(desc(staffAccountsTable.updatedAt))
    .limit(1);

  const staff = result[0];
  // A disabled staff record should always revoke dashboard access, including owners/admins.
  if (staff && !staff.isActive) return null;

  if (user.role === "admin") return "ADMIN";
  if (!staff || !staff.isActive) return null;
  return mapStaffRoleToAdminRole(staff.role);
}

// ─── Category helpers ───
export async function getAllCategories() {
  const db = await getDb();
  if (!db) return demoCategories;
  return db.select().from(categories).orderBy(asc(categories.sortOrder));
}

export async function getCategoryBySlug(slug: string) {
  const db = await getDb();
  if (!db) return demoCategories.find(c => c.slug === slug);
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return result[0];
}

export async function getCategoryById(id: number) {
  const db = await getDb();
  if (!db) return demoCategories.find(c => c.id === id);
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return result[0];
}

export async function createCategory(data: {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  coverImageUrl?: string;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) {
    const nextId =
      demoCategories.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    demoCategories.push({
      id: nextId,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      sortOrder: data.sortOrder ?? nextId,
      createdAt: new Date(),
    });
    return nextId;
  }
  const result = await db.insert(categories).values(data);
  return result[0].insertId;
}

export async function updateCategory(
  id: number,
  data: Partial<{
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    coverImageUrl: string;
    sortOrder: number;
  }>
) {
  const db = await getDb();
  if (!db) {
    const index = demoCategories.findIndex(category => category.id === id);
    if (index < 0) return;
    demoCategories[index] = {
      ...demoCategories[index],
      ...Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
      ),
    };
    return;
  }
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) {
    const index = demoCategories.findIndex(category => category.id === id);
    if (index >= 0) demoCategories.splice(index, 1);
    return;
  }
  await db.delete(categories).where(eq(categories.id, id));
}

// ─── Product helpers ───
function normalizeProductBulletList(
  value: unknown,
  maxItems: number
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => entry.length > 0)
    .slice(0, maxItems);
}

function normalizeProductRoutineSteps(value: unknown): ProductRoutineStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const rawTitle = (entry as { title?: unknown }).title;
      const rawText = (entry as { text?: unknown }).text;
      const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
      const text = typeof rawText === "string" ? rawText.trim() : "";
      if (!title || !text) return null;
      return {
        title: title.slice(0, 80),
        text: text.slice(0, 700),
      };
    })
    .filter((entry): entry is ProductRoutineStep => Boolean(entry))
    .slice(0, MAX_PRODUCT_ROUTINE_STEPS);
}

function normalizeProductRoutine(value: unknown): ProductRoutine {
  if (!value || typeof value !== "object") {
    return { am: [], pm: [] };
  }
  const candidate = value as { am?: unknown; pm?: unknown };
  return {
    am: normalizeProductRoutineSteps(candidate.am),
    pm: normalizeProductRoutineSteps(candidate.pm),
  };
}

function normalizeProductContentFields(
  input: Partial<ProductContentFields> | undefined
): ProductContentFields {
  return {
    benefits: normalizeProductBulletList(input?.benefits, MAX_PRODUCT_BULLETS),
    descriptionBullets: normalizeProductBulletList(
      input?.descriptionBullets,
      MAX_PRODUCT_DESCRIPTION_BULLETS
    ),
    routine: normalizeProductRoutine(input?.routine),
  };
}

function serializeProductContentFields(
  input: Partial<ProductContentFields> | undefined
) {
  const normalized = normalizeProductContentFields(input);
  return {
    benefitsJson: JSON.stringify(normalized.benefits),
    descriptionJson: JSON.stringify(normalized.descriptionBullets),
    routineJson: JSON.stringify(normalized.routine),
  };
}

function parseProductContentFromRow(row: any): ProductContentFields {
  const benefitsSource = Array.isArray(row?.benefits)
    ? row.benefits
    : safeJsonParse<unknown>(row?.benefitsJson, []);
  const descriptionSource = Array.isArray(row?.descriptionBullets)
    ? row.descriptionBullets
    : safeJsonParse<unknown>(row?.descriptionJson, []);
  const routineSource =
    row?.routine && typeof row.routine === "object"
      ? row.routine
      : safeJsonParse<unknown>(row?.routineJson, { am: [], pm: [] });

  return {
    benefits: normalizeProductBulletList(benefitsSource, MAX_PRODUCT_BULLETS),
    descriptionBullets: normalizeProductBulletList(
      descriptionSource,
      MAX_PRODUCT_DESCRIPTION_BULLETS
    ),
    routine: normalizeProductRoutine(routineSource),
  };
}

function withParsedProductContent<T extends Record<string, any> | undefined>(
  row: T
) {
  if (!row) return row;
  return {
    ...row,
    ...parseProductContentFromRow(row),
  };
}

export async function getProducts(opts: {
  categoryId?: number;
  search?: string;
  featured?: boolean;
  isNew?: boolean;
  trending?: boolean;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) {
    let productsData = [...demoProducts];
    if (opts.categoryId)
      productsData = productsData.filter(p => p.categoryId === opts.categoryId);
    if (opts.featured) productsData = productsData.filter(p => p.isFeatured);
    if (opts.isNew) productsData = productsData.filter(p => p.isNew);
    if (opts.trending) productsData = productsData.filter(p => p.isTrending);
    if (opts.search) {
      const q = opts.search.toLowerCase();
      productsData = productsData.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
      );
    }
    const total = productsData.length;
    const offset = opts.offset || 0;
    const limit = opts.limit || 50;
    return {
      products: productsData
        .slice(offset, offset + limit)
        .map(entry => withParsedProductContent(entry)),
      total,
    };
  }
  const conditions = [];
  if (opts.categoryId)
    conditions.push(eq(products.categoryId, opts.categoryId));
  if (opts.featured) conditions.push(eq(products.isFeatured, true));
  if (opts.isNew) conditions.push(eq(products.isNew, true));
  if (opts.trending) conditions.push(eq(products.isTrending, true));
  if (opts.search) {
    conditions.push(
      or(
        like(products.name, `%${opts.search}%`),
        like(products.description, `%${opts.search}%`)
      )
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(opts.limit || 50)
      .offset(opts.offset || 0),
    db.select({ count: count() }).from(products).where(where),
  ]);
  return {
    products: rows.map(entry => withParsedProductContent(entry)),
    total: countResult[0]?.count || 0,
  };
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) {
    return withParsedProductContent(demoProducts.find(p => p.id === id));
  }
  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return withParsedProductContent(result[0]);
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  if (!db) {
    return withParsedProductContent(demoProducts.find(p => p.slug === slug));
  }
  const result = await db
    .select()
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return withParsedProductContent(result[0]);
}

export async function getRelatedProducts(
  categoryId: number,
  excludeId: number,
  limit = 8
) {
  const db = await getDb();
  if (!db) {
    return demoProducts
      .filter(p => p.categoryId === categoryId && p.id !== excludeId)
      .slice(0, limit)
      .map(entry => withParsedProductContent(entry));
  }
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.categoryId, categoryId),
        sql`${products.id} != ${excludeId}`
      )
    )
    .limit(limit);
  return rows.map(entry => withParsedProductContent(entry));
}

export async function createProduct(data: {
  name: string;
  slug: string;
  description?: string;
  price: number;
  comparePrice?: number;
  categoryId: number;
  imageUrl?: string;
  images?: string;
  inStock?: boolean;
  stockQuantity?: number;
  isFeatured?: boolean;
  isNew?: boolean;
  isTrending?: boolean;
  benefits?: string[];
  descriptionBullets?: string[];
  routine?: ProductRoutine;
}) {
  const { benefits, descriptionBullets, routine, ...baseData } = data;
  const serializedContent = serializeProductContentFields({
    benefits,
    descriptionBullets,
    routine,
  });
  const normalizedContent = normalizeProductContentFields({
    benefits,
    descriptionBullets,
    routine,
  });
  const db = await getDb();
  if (!db) {
    const nextId =
      demoProducts.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const now = new Date();
    demoProducts.push({
      id: nextId,
      name: baseData.name,
      slug: baseData.slug,
      description: baseData.description ?? "",
      benefitsJson: serializedContent.benefitsJson,
      descriptionJson: serializedContent.descriptionJson,
      routineJson: serializedContent.routineJson,
      benefits: normalizedContent.benefits,
      descriptionBullets: normalizedContent.descriptionBullets,
      routine: normalizedContent.routine,
      price: baseData.price,
      comparePrice: baseData.comparePrice ?? null,
      categoryId: baseData.categoryId,
      imageUrl: baseData.imageUrl ?? "",
      images: baseData.images ?? null,
      inStock: baseData.inStock ?? true,
      stockQuantity: baseData.stockQuantity ?? 0,
      isFeatured: baseData.isFeatured ?? false,
      isNew: baseData.isNew ?? false,
      isTrending: baseData.isTrending ?? false,
      createdAt: now,
      updatedAt: now,
    });
    return nextId;
  }
  const result = await db.insert(products).values({
    ...baseData,
    ...serializedContent,
  });
  return result[0].insertId;
}

export async function updateProduct(
  id: number,
  data: Partial<{
    name: string;
    slug: string;
    description: string;
    price: number;
    comparePrice: number;
    categoryId: number;
    imageUrl: string;
    images: string;
    inStock: boolean;
    stockQuantity: number;
    isFeatured: boolean;
    isNew: boolean;
    isTrending: boolean;
    benefits: string[];
    descriptionBullets: string[];
    routine: ProductRoutine;
  }>
) {
  const { benefits, descriptionBullets, routine, ...baseData } = data;
  const updateData: Record<string, unknown> = {
    ...baseData,
  };
  if (benefits !== undefined) {
    updateData.benefitsJson = JSON.stringify(
      normalizeProductBulletList(benefits, MAX_PRODUCT_BULLETS)
    );
  }
  if (descriptionBullets !== undefined) {
    updateData.descriptionJson = JSON.stringify(
      normalizeProductBulletList(
        descriptionBullets,
        MAX_PRODUCT_DESCRIPTION_BULLETS
      )
    );
  }
  if (routine !== undefined) {
    updateData.routineJson = JSON.stringify(normalizeProductRoutine(routine));
  }
  const db = await getDb();
  if (!db) {
    const index = demoProducts.findIndex(product => product.id === id);
    if (index < 0) return;
    const current = demoProducts[index];
    demoProducts[index] = {
      ...demoProducts[index],
      ...Object.fromEntries(
        Object.entries(updateData).filter(([, value]) => value !== undefined)
      ),
      ...parseProductContentFromRow({
        benefitsJson:
          updateData.benefitsJson ??
          (typeof current?.benefitsJson === "string"
            ? current.benefitsJson
            : JSON.stringify(
                normalizeProductBulletList(
                  current?.benefits,
                  MAX_PRODUCT_BULLETS
                )
              )),
        descriptionJson:
          updateData.descriptionJson ??
          (typeof current?.descriptionJson === "string"
            ? current.descriptionJson
            : JSON.stringify(
                normalizeProductBulletList(
                  current?.descriptionBullets,
                  MAX_PRODUCT_DESCRIPTION_BULLETS
                )
              )),
        routineJson:
          updateData.routineJson ??
          (typeof current?.routineJson === "string"
            ? current.routineJson
            : JSON.stringify(normalizeProductRoutine(current?.routine))),
      }),
      updatedAt: new Date(),
    };
    return;
  }
  if (Object.keys(updateData).length === 0) return;
  await db.update(products).set(updateData).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) {
    const index = demoProducts.findIndex(product => product.id === id);
    if (index >= 0) demoProducts.splice(index, 1);
    return;
  }
  await db.delete(products).where(eq(products.id, id));
}

// ─── Order helpers ───
export async function createOrder(data: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCity?: string;
  subtotalAmount?: number;
  shippingFee?: number;
  couponCode?: string | null;
  discountAmount?: number;
  discountType?: string | null;
  totalAmount: number;
  totalPaid?: number;
  paymentMethod: string;
  notes?: string;
  userId?: number;
  items: {
    productId: number;
    productName: string;
    productImage?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
}) {
  const db = await getDb();
  if (!db) {
    const { items, ...orderData } = data;
    const orderId = demoOrderIdSeq++;
    const now = new Date();
    const order = {
      id: orderId,
      ...orderData,
      subtotalAmount: Number(orderData.subtotalAmount || 0),
      shippingFee: Number(orderData.shippingFee || 0),
      couponCode: orderData.couponCode ?? null,
      discountAmount: Number(orderData.discountAmount || 0),
      discountType: orderData.discountType ?? null,
      totalPaid: Number(orderData.totalPaid ?? 0),
      status: "pending",
      paymentStatus:
        orderData.paymentMethod === "orange_money" ||
        orderData.paymentMethod === "wave" ||
        orderData.paymentMethod === "free_money"
          ? "processing"
          : "pending",
      paymentReference: null,
      createdAt: now,
      updatedAt: now,
    };
    demoOrders.push(order);
    if (items.length > 0) {
      for (const item of items) {
        demoOrderItems.push({
          id: demoOrderItemIdSeq++,
          orderId,
          ...item,
        });
      }
    }
    return orderId;
  }
  const { items, ...orderData } = data;
  const result = await db.insert(orders).values(orderData);
  const orderId = result[0].insertId;
  if (items.length > 0) {
    await db
      .insert(orderItems)
      .values(items.map(item => ({ ...item, orderId })));
  }
  return orderId;
}

export function __resetDemoOrdersForTests() {
  demoOrders.length = 0;
  demoOrderItems.length = 0;
  demoOrderIdSeq = 1;
  demoOrderItemIdSeq = 1;
}

export async function getOrders(
  opts: {
    status?: string;
    paymentStatus?: string;
    query?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const db = await getDb();
  const trimmedQuery = opts.query?.trim();
  const queryLc = trimmedQuery ? trimmedQuery.toLowerCase() : undefined;

  if (!db) {
    const statusMatches = (o: any) =>
      !opts.status || opts.status === "all" || o.status === opts.status;
    const paymentMatches = (o: any) =>
      !opts.paymentStatus ||
      opts.paymentStatus === "all" ||
      o.paymentStatus === opts.paymentStatus;
    const queryMatches = (o: any) => {
      if (!queryLc) return true;
      return (
        (o.orderNumber ?? "").toString().toLowerCase().includes(queryLc) ||
        (o.customerName ?? "").toString().toLowerCase().includes(queryLc) ||
        (o.customerPhone ?? "").toString().toLowerCase().includes(queryLc)
      );
    };

    const filtered = demoOrders.filter(
      o => statusMatches(o) && paymentMatches(o) && queryMatches(o)
    );
    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const offset = opts.offset || 0;
    const limit = opts.limit || 50;
    return {
      orders: sorted.slice(offset, offset + limit),
      total: sorted.length,
    };
  }

  const conditions: any[] = [];
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(orders.status, opts.status as any));
  }
  if (opts.paymentStatus && opts.paymentStatus !== "all") {
    conditions.push(eq(orders.paymentStatus, opts.paymentStatus as any));
  }
  if (trimmedQuery) {
    const pattern = `%${trimmedQuery}%`;
    conditions.push(
      or(
        like(orders.orderNumber, pattern),
        like(orders.customerName, pattern),
        like(orders.customerPhone, pattern)
      )!
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(opts.limit || 50)
      .offset(opts.offset || 0),
    db.select({ count: count() }).from(orders).where(where),
  ]);
  return { orders: rows, total: countResult[0]?.count || 0 };
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) {
    const order = demoOrders.find(o => o.id === id);
    if (!order) return undefined;
    const items = demoOrderItems.filter(i => i.orderId === id);
    return { ...order, items };
  }
  const [orderResult, itemsResult] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, id)).limit(1),
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
  ]);
  if (!orderResult[0]) return undefined;
  return { ...orderResult[0], items: itemsResult };
}

export async function getOrderByNumber(orderNumber: string) {
  const db = await getDb();
  if (!db) {
    const order = demoOrders.find(o => o.orderNumber === orderNumber);
    if (!order) return undefined;
    const items = demoOrderItems.filter(i => i.orderId === order.id);
    return { ...order, items };
  }
  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!result[0]) return undefined;
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, result[0].id));
  return { ...result[0], items };
}

export async function updateOrderStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) {
    const order = demoOrders.find(o => o.id === id);
    if (!order) throw new Error("Order not found");
    order.status = status;
    order.updatedAt = new Date();
    return;
  }
  await db
    .update(orders)
    .set({ status: status as any })
    .where(eq(orders.id, id));
}

export async function updatePaymentStatus(
  id: number,
  paymentStatus: string,
  paymentReference?: string
) {
  const db = await getDb();
  if (!db) {
    const order = demoOrders.find(o => o.id === id);
    if (!order) throw new Error("Order not found");
    order.paymentStatus = paymentStatus;
    if (paymentReference) order.paymentReference = paymentReference;
    // Keep totalPaid in sync so revenue/reporting reflects actual confirmed payments.
    if (paymentStatus === "completed") {
      order.totalPaid = order.totalAmount;
    } else if (paymentStatus === "failed" || paymentStatus === "pending") {
      order.totalPaid = 0;
    }
    order.updatedAt = new Date();
    return;
  }
  const data: any = { paymentStatus };
  if (paymentReference) data.paymentReference = paymentReference;
  if (paymentStatus === "completed") {
    data.totalPaid = sql`${orders.totalAmount}`;
  } else if (paymentStatus === "failed" || paymentStatus === "pending") {
    data.totalPaid = 0;
  }
  await db.update(orders).set(data).where(eq(orders.id, id));
}

// ─── Analytics helpers ───
export async function recordPageView(data: {
  page: string;
  visitorId: string;
  sessionId?: string;
  referrer?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) {
    demoPageViews.push({ ...data, createdAt: new Date() });
    return;
  }
  await db.insert(pageViews).values(data);
}

export async function getAnalytics(days = 30) {
  const db = await getDb();
  if (!db) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentViews = demoPageViews.filter(v => v.createdAt >= since);
    const recentOrders = demoOrders.filter(o => new Date(o.createdAt) >= since);
    const totalViews = recentViews.length;
    const uniqueVisitors = new Set(recentViews.map(v => v.visitorId)).size;
    const totalOrders = recentOrders.length;
    const totalRevenue = recentOrders
      .filter(o => o.paymentStatus !== "failed")
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const ordersByStatusMap = new Map<string, number>();
    for (const order of recentOrders) {
      ordersByStatusMap.set(
        order.status,
        (ordersByStatusMap.get(order.status) || 0) + 1
      );
    }
    const ordersByStatus = Array.from(ordersByStatusMap.entries()).map(
      ([status, count]) => ({ status, count })
    );
    const conversionRate =
      uniqueVisitors > 0 ? (totalOrders / uniqueVisitors) * 100 : 0;
    return {
      totalViews,
      uniqueVisitors,
      totalOrders,
      totalRevenue,
      conversionRate: Math.round(conversionRate * 100) / 100,
      recentViews: [],
      ordersByStatus,
    };
  }
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    viewsResult,
    visitorsResult,
    ordersResult,
    revenueResult,
    ordersByStatusResult,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since)),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${pageViews.visitorId})` })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since)),
    db
      .select({ count: count() })
      .from(orders)
      .where(gte(orders.createdAt, since)),
    db
      .select({ total: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, since),
          sql`${orders.paymentStatus} != 'failed'`
        )
      ),
    db
      .select({ status: orders.status, count: count() })
      .from(orders)
      .where(gte(orders.createdAt, since))
      .groupBy(orders.status),
  ]);

  const totalViews = viewsResult[0]?.count || 0;
  const uniqueVisitors = visitorsResult[0]?.count || 0;
  const totalOrders = ordersResult[0]?.count || 0;
  const totalRevenue = revenueResult[0]?.total || 0;
  const conversionRate =
    uniqueVisitors > 0 ? (totalOrders / uniqueVisitors) * 100 : 0;

  return {
    totalViews,
    uniqueVisitors,
    totalOrders,
    totalRevenue,
    conversionRate: Math.round(conversionRate * 100) / 100,
    recentViews: [],
    ordersByStatus: ordersByStatusResult,
  };
}

export type AnalyticsEventType =
  | "page_view"
  | "add_to_cart"
  | "checkout_start"
  | "purchase";

export type AdminAnalyticsOverview = {
  rangeDays: number;
  revenue: number;
  orders: number;
  customers: number;
  aov: number;
  conversionRate: number | null;
  bestSellers: Array<{
    productId: number;
    name: string;
    soldQty: number;
    revenue: number;
    imageUrl: string | null;
  }>;
  ordersByStatus: Array<{ status: string; count: number }>;
  revenueSeries: Array<{ date: string; revenue: number; orders: number }>;
  lowStock: Array<{
    productId: number;
    name: string;
    stock: number;
    threshold: number;
  }>;
  failedPayments: Array<{ orderId: number; amount: number; createdAt: string }>;
  recentOrders: Array<{
    orderId: number;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
  topCustomers: Array<{
    customerPhone: string;
    customerName: string;
    orderCount: number;
    totalSpent: number;
  }>;
};

function getDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildRangeSeries(days: number) {
  const map = new Map<string, { revenue: number; orders: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    map.set(getDateKey(day), { revenue: 0, orders: 0 });
  }
  return map;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function isMissingTableError(error: unknown) {
  const message = String((error as any)?.message || error || "");
  return (
    message.includes("doesn't exist") ||
    message.includes("ER_NO_SUCH_TABLE") ||
    message.includes("no such table")
  );
}

async function getConversionRateFromEvents(
  since: Date
): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    const pageViewsCount = demoAnalyticsEvents.filter(
      event => event.type === "page_view" && event.createdAt >= since
    ).length;
    const purchaseCount = demoAnalyticsEvents.filter(
      event => event.type === "purchase" && event.createdAt >= since
    ).length;

    if (pageViewsCount === 0) return null;
    return round2((purchaseCount / pageViewsCount) * 100);
  }

  try {
    const [pageViewsResult, purchasesResult] = await Promise.all([
      db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.type, "page_view"),
            gte(analyticsEvents.createdAt, since)
          )
        ),
      db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.type, "purchase"),
            gte(analyticsEvents.createdAt, since)
          )
        ),
    ]);

    const pageViewsCount = Number(pageViewsResult[0]?.count || 0);
    const purchaseCount = Number(purchasesResult[0]?.count || 0);

    if (pageViewsCount === 0) return 0;
    return round2((purchaseCount / pageViewsCount) * 100);
  } catch (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function recordAnalyticsEvent(data: {
  type: AnalyticsEventType;
  sessionId: string;
  userId?: number | null;
  path: string;
  meta?: Record<string, unknown> | null;
}) {
  const db = await getDb();
  if (!db) {
    demoAnalyticsEvents.push({
      id: demoAnalyticsEventIdSeq++,
      type: data.type,
      sessionId: data.sessionId,
      userId: data.userId ?? null,
      path: data.path,
      meta: data.meta ? JSON.stringify(data.meta) : null,
      createdAt: new Date(),
    });
    return;
  }

  try {
    await db.insert(analyticsEvents).values({
      type: data.type,
      sessionId: data.sessionId,
      userId: data.userId ?? null,
      path: data.path,
      meta: data.meta ? JSON.stringify(data.meta) : null,
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return;
    }
    throw error;
  }
}

export async function getAdminAnalyticsOverview(
  days = 30,
  lowStockThreshold = 8
): Promise<AdminAnalyticsOverview> {
  const safeDays = Math.min(365, Math.max(1, Math.floor(days || 30)));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const db = await getDb();

  if (!db) {
    const revenueSeriesMap = buildRangeSeries(safeDays);
    const recentOrders = demoOrders.filter(
      order => new Date(order.createdAt) >= since
    );
    const recentPaidOrders = recentOrders.filter(
      order => order.paymentStatus !== "failed"
    );
    const revenue = recentPaidOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0
    );
    const orderCount = recentOrders.length;
    const customers = new Set(
      recentOrders
        .map(order => String(order.customerPhone || ""))
        .filter(Boolean)
    ).size;

    for (const order of recentOrders) {
      const key = getDateKey(new Date(order.createdAt));
      const current = revenueSeriesMap.get(key);
      if (!current) continue;
      current.orders += 1;
      if (order.paymentStatus !== "failed") {
        current.revenue += Number(order.totalAmount || 0);
      }
    }

    const ordersByStatusMap = new Map<string, number>();
    for (const order of recentOrders) {
      const status = String(order.status || "pending");
      ordersByStatusMap.set(status, (ordersByStatusMap.get(status) || 0) + 1);
    }

    const recentOrderIds = new Set(
      recentPaidOrders.map(order => Number(order.id))
    );
    const bestSellersMap = new Map<
      number,
      {
        productId: number;
        name: string;
        soldQty: number;
        revenue: number;
        imageUrl: string | null;
      }
    >();
    for (const item of demoOrderItems) {
      if (!recentOrderIds.has(Number(item.orderId))) continue;
      const productId = Number(item.productId);
      const product = demoProducts.find(
        entry => Number(entry.id) === productId
      );
      if (!product) continue;
      const current = bestSellersMap.get(productId) || {
        productId,
        name: String(product.name || "Produit"),
        soldQty: 0,
        revenue: 0,
        imageUrl: product.imageUrl || null,
      };
      current.soldQty += Number(item.quantity || 0);
      current.revenue += Number(item.totalPrice || 0);
      bestSellersMap.set(productId, current);
    }

    const lowStock = demoProducts
      .filter(
        product =>
          Boolean(product.inStock) &&
          Number(product.stockQuantity ?? 0) < lowStockThreshold
      )
      .sort(
        (left, right) =>
          Number(left.stockQuantity || 0) - Number(right.stockQuantity || 0)
      )
      .slice(0, 10)
      .map(product => ({
        productId: Number(product.id),
        name: String(product.name || "Produit"),
        stock: Number(product.stockQuantity || 0),
        threshold: lowStockThreshold,
      }));

    const failedPayments = recentOrders
      .filter(order => order.paymentStatus === "failed")
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
      )
      .slice(0, 20)
      .map(order => ({
        orderId: Number(order.id),
        amount: Number(order.totalAmount || 0),
        createdAt: new Date(order.createdAt).toISOString(),
      }));

    const conversionRate = await getConversionRateFromEvents(since);

    const recentOrdersList = [...recentOrders]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime()
      )
      .slice(0, 6)
      .map(order => ({
        orderId: Number(order.id),
        orderNumber: String(order.orderNumber || `#${order.id}`),
        customerName: String(order.customerName || "Client"),
        totalAmount: Number(order.totalAmount || 0),
        status: String(order.status || "pending"),
        paymentStatus: String(order.paymentStatus || "pending"),
        createdAt: new Date(order.createdAt).toISOString(),
      }));

    const topCustomersMap = new Map<
      string,
      {
        customerPhone: string;
        customerName: string;
        orderCount: number;
        totalSpent: number;
      }
    >();
    for (const order of recentPaidOrders) {
      const phone = String(order.customerPhone || "").trim();
      if (!phone) continue;
      const current = topCustomersMap.get(phone) || {
        customerPhone: phone,
        customerName: String(order.customerName || "Client"),
        orderCount: 0,
        totalSpent: 0,
      };
      current.orderCount += 1;
      current.totalSpent += Number(order.totalAmount || 0);
      topCustomersMap.set(phone, current);
    }
    const topCustomersList = Array.from(topCustomersMap.values())
      .sort((left, right) => right.totalSpent - left.totalSpent)
      .slice(0, 5);

    return {
      rangeDays: safeDays,
      revenue: Number(revenue || 0),
      orders: Number(orderCount || 0),
      customers: Number(customers || 0),
      aov: orderCount > 0 ? Number(revenue || 0) / orderCount : 0,
      conversionRate,
      bestSellers: Array.from(bestSellersMap.values())
        .sort((left, right) => right.soldQty - left.soldQty)
        .slice(0, 5),
      ordersByStatus: Array.from(ordersByStatusMap.entries()).map(
        ([status, countValue]) => ({
          status,
          count: Number(countValue || 0),
        })
      ),
      revenueSeries: Array.from(revenueSeriesMap.entries()).map(
        ([date, value]) => ({
          date,
          revenue: Number(value.revenue || 0),
          orders: Number(value.orders || 0),
        })
      ),
      lowStock,
      failedPayments,
      recentOrders: recentOrdersList,
      topCustomers: topCustomersList,
    };
  }

  const revenueSeriesMap = buildRangeSeries(safeDays);
  const summaryQuery = db
    .select({
      orders: count(),
      revenue: sql<number>`COALESCE(SUM(CASE WHEN ${orders.paymentStatus} != 'failed' THEN ${orders.totalAmount} ELSE 0 END), 0)`,
      customers: sql<number>`COUNT(DISTINCT ${orders.customerPhone})`,
    })
    .from(orders)
    .where(gte(orders.createdAt, since));

  const ordersByStatusQuery = db
    .select({
      status: orders.status,
      count: count(),
    })
    .from(orders)
    .where(gte(orders.createdAt, since))
    .groupBy(orders.status);

  const revenueSeriesQuery = db.execute(
    sql`SELECT DATE(createdAt) as date_val, COALESCE(SUM(CASE WHEN paymentStatus != 'failed' THEN totalAmount ELSE 0 END), 0) as revenue, COUNT(*) as orders FROM orders WHERE createdAt >= ${since} GROUP BY date_val ORDER BY date_val`
  );

  const bestSellersQuery = db
    .select({
      productId: products.id,
      name: products.name,
      imageUrl: products.imageUrl,
      soldQty: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${orderItems.totalPrice}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(
      and(
        gte(orders.createdAt, since),
        sql`${orders.paymentStatus} != 'failed'`
      )
    )
    .groupBy(products.id)
    .orderBy(desc(sql`SUM(${orderItems.quantity})`))
    .limit(5);

  const lowStockQuery = db
    .select({
      productId: products.id,
      name: products.name,
      stock: products.stockQuantity,
    })
    .from(products)
    .where(
      and(
        eq(products.inStock, true),
        lt(products.stockQuantity, lowStockThreshold)
      )
    )
    .orderBy(products.stockQuantity)
    .limit(10);

  const failedPaymentsQuery = db
    .select({
      orderId: orders.id,
      amount: orders.totalAmount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(gte(orders.createdAt, since), eq(orders.paymentStatus, "failed"))
    )
    .orderBy(desc(orders.createdAt))
    .limit(20);

  const recentOrdersQuery = db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      totalAmount: orders.totalAmount,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(gte(orders.createdAt, since))
    .orderBy(desc(orders.createdAt))
    .limit(6);

  const topCustomersQuery = db
    .select({
      customerPhone: orders.customerPhone,
      customerName: sql<string>`MAX(${orders.customerName})`,
      orderCount: count(),
      totalSpent: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, since),
        sql`${orders.paymentStatus} != 'failed'`
      )
    )
    .groupBy(orders.customerPhone)
    .orderBy(desc(sql`SUM(${orders.totalAmount})`))
    .limit(5);

  const [
    summaryRows,
    ordersByStatusRows,
    revenueSeriesRows,
    bestSellersRows,
    lowStockRows,
    failedPaymentsRows,
    recentOrdersRows,
    topCustomersRows,
    conversionRate,
  ] = await Promise.all([
    summaryQuery,
    ordersByStatusQuery,
    revenueSeriesQuery,
    bestSellersQuery,
    lowStockQuery,
    failedPaymentsQuery.catch(error => {
      if (isMissingTableError(error)) return [];
      throw error;
    }),
    recentOrdersQuery,
    topCustomersQuery,
    getConversionRateFromEvents(since),
  ]);

  const revenueRows = Array.isArray(revenueSeriesRows)
    ? (revenueSeriesRows as any[])
    : (((revenueSeriesRows as any)?.[0] ?? []) as any[]);
  for (const row of revenueRows) {
    const key =
      typeof row.date_val === "string"
        ? row.date_val.slice(0, 10)
        : typeof row.date === "string"
          ? row.date.slice(0, 10)
          : String(row.date_val ?? row.date ?? "");
    if (!revenueSeriesMap.has(key)) continue;
    revenueSeriesMap.set(key, {
      revenue: Number(row.revenue || 0),
      orders: Number(row.orders || 0),
    });
  }

  const summary = summaryRows[0] || { orders: 0, revenue: 0, customers: 0 };
  const revenue = Number(summary.revenue || 0);
  const orderCount = Number(summary.orders || 0);

  return {
    rangeDays: safeDays,
    revenue,
    orders: orderCount,
    customers: Number(summary.customers || 0),
    aov: orderCount > 0 ? revenue / orderCount : 0,
    conversionRate,
    bestSellers: bestSellersRows.map(row => ({
      productId: Number(row.productId),
      name: row.name,
      soldQty: Number(row.soldQty || 0),
      revenue: Number(row.revenue || 0),
      imageUrl: row.imageUrl || null,
    })),
    ordersByStatus: ordersByStatusRows.map(row => ({
      status: row.status || "pending",
      count: Number(row.count || 0),
    })),
    revenueSeries: Array.from(revenueSeriesMap.entries()).map(
      ([date, value]) => ({
        date,
        revenue: Number(value.revenue || 0),
        orders: Number(value.orders || 0),
      })
    ),
    lowStock: lowStockRows.map(row => ({
      productId: Number(row.productId),
      name: row.name,
      stock: Number(row.stock || 0),
      threshold: lowStockThreshold,
    })),
    failedPayments: failedPaymentsRows.map(row => ({
      orderId: Number((row as any).orderId || 0),
      amount: Number((row as any).amount || 0),
      createdAt: new Date((row as any).createdAt).toISOString(),
    })),
    recentOrders: recentOrdersRows.map(row => ({
      orderId: Number(row.orderId),
      orderNumber: String(row.orderNumber || `#${row.orderId}`),
      customerName: String(row.customerName || "Client"),
      totalAmount: Number(row.totalAmount || 0),
      status: String(row.status || "pending"),
      paymentStatus: String(row.paymentStatus || "pending"),
      createdAt: new Date(row.createdAt).toISOString(),
    })),
    topCustomers: topCustomersRows.map(row => ({
      customerPhone: String(row.customerPhone || ""),
      customerName: String(row.customerName || "Client"),
      orderCount: Number(row.orderCount || 0),
      totalSpent: Number(row.totalSpent || 0),
    })),
  };
}

export async function getProductCount() {
  const db = await getDb();
  if (!db) return demoProducts.length;
  const result = await db.select({ count: count() }).from(products);
  return result[0]?.count || 0;
}

// ─── Delivery Zones ───
export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const db = await getDb();
  if (!db) return demoDeliveryZones;
  return db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.isActive, true))
    .orderBy(deliveryZones.displayOrder);
}

export async function getDeliveryZoneById(
  id: number
): Promise<DeliveryZone | undefined> {
  const db = await getDb();
  if (!db) return demoDeliveryZones.find(z => z.id === id);
  const result = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.id, id))
    .limit(1);
  return result[0];
}

export async function getDeliveryZoneBySlug(
  slug: string
): Promise<DeliveryZone | undefined> {
  const db = await getDb();
  if (!db) return demoDeliveryZones.find(z => z.slug === slug);
  const result = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.slug, slug))
    .limit(1);
  return result[0];
}

function mapShippingZoneRow(
  row: Pick<
    DeliveryZone,
    | "id"
    | "name"
    | "slug"
    | "description"
    | "deliveryFee"
    | "deliveryDays"
    | "isActive"
    | "displayOrder"
    | "createdAt"
    | "updatedAt"
  >
): ShippingZone {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    deliveryFee: Number(row.deliveryFee || 0),
    deliveryDays: Number(row.deliveryDays || 0),
    isActive: Boolean(row.isActive),
    displayOrder: Number(row.displayOrder || 0),
    createdAt: toIso(row.createdAt) || new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) || new Date().toISOString(),
  };
}

type ShippingRateRowShape = {
  id: number;
  zoneId: number;
  label: string;
  minAmountCfa: number;
  maxAmountCfa: number | null;
  feeCfa: number;
  etaMinHours: number;
  etaMaxHours: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function mapShippingRateRow(row: ShippingRateRowShape): ShippingRate {
  return {
    id: Number(row.id),
    zoneId: Number(row.zoneId),
    label: row.label,
    minAmountCfa: Number(row.minAmountCfa || 0),
    maxAmountCfa: row.maxAmountCfa == null ? null : Number(row.maxAmountCfa),
    feeCfa: Number(row.feeCfa || 0),
    etaMinHours: Number(row.etaMinHours || 0),
    etaMaxHours: Number(row.etaMaxHours || 0),
    isActive: Boolean(row.isActive),
    createdAt: toIso(row.createdAt) || new Date().toISOString(),
    updatedAt: toIso(row.updatedAt) || new Date().toISOString(),
  };
}

async function syncZoneSnapshotFromRates(zoneId: number) {
  const db = await getDb();
  if (!db) {
    const zone = demoDeliveryZones.find(item => item.id === zoneId);
    if (!zone) return;
    const primary = demoShippingRates
      .filter(rate => rate.zoneId === zoneId && rate.isActive)
      .sort(
        (left, right) =>
          left.minAmountCfa - right.minAmountCfa || left.id - right.id
      )[0];
    if (!primary) return;
    zone.deliveryFee = primary.feeCfa;
    zone.deliveryDays = Math.max(1, Math.ceil(primary.etaMaxHours / 24));
    zone.updatedAt = new Date();
    return;
  }

  const { shippingRates: shippingRatesTable } =
    await import("../drizzle/schema");
  const rates = await db
    .select()
    .from(shippingRatesTable)
    .where(
      and(
        eq(shippingRatesTable.zoneId, zoneId),
        eq(shippingRatesTable.isActive, true)
      )
    )
    .orderBy(asc(shippingRatesTable.minAmountCfa), asc(shippingRatesTable.id))
    .limit(1);

  const primary = rates[0];
  if (!primary) return;
  await db
    .update(deliveryZones)
    .set({
      deliveryFee: Number(primary.feeCfa || 0),
      deliveryDays: Math.max(
        1,
        Math.ceil(Number(primary.etaMaxHours || 24) / 24)
      ),
    })
    .where(eq(deliveryZones.id, zoneId));
}

export type ShippingZoneWithRates = ShippingZone & { rates: ShippingRate[] };

export async function listShippingZonesWithRates(): Promise<
  ShippingZoneWithRates[]
> {
  const db = await getDb();
  if (!db) {
    return demoDeliveryZones
      .slice()
      .sort(
        (left, right) =>
          left.displayOrder - right.displayOrder || left.id - right.id
      )
      .map(zone => ({
        ...mapShippingZoneRow(zone),
        rates: demoShippingRates
          .filter(rate => rate.zoneId === zone.id)
          .sort(
            (left, right) =>
              left.minAmountCfa - right.minAmountCfa || left.id - right.id
          )
          .map(mapShippingRateRow),
      }));
  }

  const zones = await db
    .select()
    .from(deliveryZones)
    .orderBy(asc(deliveryZones.displayOrder), asc(deliveryZones.id));

  let ratesByZoneId = new Map<number, ShippingRate[]>();
  try {
    const { shippingRates: shippingRatesTable } =
      await import("../drizzle/schema");
    const rateRows = await db
      .select()
      .from(shippingRatesTable)
      .orderBy(
        asc(shippingRatesTable.zoneId),
        asc(shippingRatesTable.minAmountCfa),
        asc(shippingRatesTable.id)
      );
    ratesByZoneId = rateRows.reduce((map, row) => {
      const zoneId = Number(row.zoneId);
      const list = map.get(zoneId) || [];
      list.push(mapShippingRateRow(row));
      map.set(zoneId, list);
      return map;
    }, new Map<number, ShippingRate[]>());
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  return zones.map(zone => ({
    ...mapShippingZoneRow(zone),
    rates: ratesByZoneId.get(Number(zone.id)) || [],
  }));
}

export async function createShippingZone(
  input: ShippingZoneCreate
): Promise<ShippingZone> {
  const slugBase =
    normalizeOptionalText(input.slug) || slugifyZoneName(input.name) || "zone";
  const db = await getDb();
  if (!db) {
    const id =
      (demoDeliveryZones.reduce((max, item) => Math.max(max, item.id), 0) ||
        0) + 1;
    const createdAt = new Date();
    const zone: DeliveryZone = {
      id,
      name: input.name,
      slug: slugBase,
      description: normalizeOptionalText(input.description) || null,
      deliveryFee: input.deliveryFee,
      deliveryDays: input.deliveryDays,
      isActive: input.isActive,
      displayOrder: input.displayOrder,
      createdAt,
      updatedAt: createdAt,
    };
    demoDeliveryZones.push(zone);
    return mapShippingZoneRow(zone);
  }

  const insertResult = await db.insert(deliveryZones).values({
    name: input.name,
    slug: slugBase,
    description: normalizeOptionalText(input.description) || null,
    deliveryFee: input.deliveryFee,
    deliveryDays: input.deliveryDays,
    isActive: input.isActive,
    displayOrder: input.displayOrder,
  });

  const zoneId = Number(insertResult[0]?.insertId || 0);
  if (!zoneId) {
    throw new Error("Failed to create shipping zone");
  }

  try {
    const { shippingRates: shippingRatesTable } =
      await import("../drizzle/schema");
    await db.insert(shippingRatesTable).values({
      zoneId,
      label: "Standard",
      minAmountCfa: 0,
      maxAmountCfa: null,
      feeCfa: input.deliveryFee,
      etaMinHours: Math.max(12, input.deliveryDays * 24),
      etaMaxHours: Math.max(24, input.deliveryDays * 24 + 24),
      isActive: true,
    });
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  const created = await getDeliveryZoneById(zoneId);
  if (!created) {
    throw new Error("Failed to load created shipping zone");
  }
  return mapShippingZoneRow(created);
}

export async function updateShippingZone(
  id: number,
  input: ShippingZoneUpdate
): Promise<ShippingZone | null> {
  const db = await getDb();
  if (!db) {
    const target = demoDeliveryZones.find(item => item.id === id);
    if (!target) return null;
    if (input.name !== undefined) target.name = input.name;
    if (input.slug !== undefined)
      target.slug = slugifyZoneName(input.slug) || target.slug;
    if (input.description !== undefined)
      target.description = normalizeOptionalText(input.description) || null;
    if (input.deliveryFee !== undefined) target.deliveryFee = input.deliveryFee;
    if (input.deliveryDays !== undefined)
      target.deliveryDays = input.deliveryDays;
    if (input.isActive !== undefined) target.isActive = input.isActive;
    if (input.displayOrder !== undefined)
      target.displayOrder = input.displayOrder;
    target.updatedAt = new Date();
    return mapShippingZoneRow(target);
  }

  const payload: Partial<typeof deliveryZones.$inferInsert> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.slug !== undefined)
    payload.slug = slugifyZoneName(input.slug) || input.slug;
  if (input.description !== undefined)
    payload.description = normalizeOptionalText(input.description) || null;
  if (input.deliveryFee !== undefined) payload.deliveryFee = input.deliveryFee;
  if (input.deliveryDays !== undefined)
    payload.deliveryDays = input.deliveryDays;
  if (input.isActive !== undefined) payload.isActive = input.isActive;
  if (input.displayOrder !== undefined)
    payload.displayOrder = input.displayOrder;

  if (Object.keys(payload).length > 0) {
    await db
      .update(deliveryZones)
      .set(payload as any)
      .where(eq(deliveryZones.id, id));
  }

  const updated = await getDeliveryZoneById(id);
  return updated ? mapShippingZoneRow(updated) : null;
}

export async function deleteShippingZone(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const before = demoDeliveryZones.length;
    const nextZones = demoDeliveryZones.filter(item => item.id !== id);
    demoDeliveryZones.splice(0, demoDeliveryZones.length, ...nextZones);
    const nextRates = demoShippingRates.filter(item => item.zoneId !== id);
    demoShippingRates.splice(0, demoShippingRates.length, ...nextRates);
    return before !== nextZones.length;
  }

  const existing = await db
    .select({ id: deliveryZones.id })
    .from(deliveryZones)
    .where(eq(deliveryZones.id, id))
    .limit(1);
  if (!existing[0]) return false;

  try {
    const { shippingRates: shippingRatesTable } =
      await import("../drizzle/schema");
    await db
      .delete(shippingRatesTable)
      .where(eq(shippingRatesTable.zoneId, id));
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }
  await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
  return true;
}

export async function listShippingRates(
  zoneId: number
): Promise<ShippingRate[]> {
  const db = await getDb();
  if (!db) {
    return demoShippingRates
      .filter(row => row.zoneId === zoneId)
      .sort(
        (left, right) =>
          left.minAmountCfa - right.minAmountCfa || left.id - right.id
      )
      .map(mapShippingRateRow);
  }

  try {
    const { shippingRates: shippingRatesTable } =
      await import("../drizzle/schema");
    const rows = await db
      .select()
      .from(shippingRatesTable)
      .where(eq(shippingRatesTable.zoneId, zoneId))
      .orderBy(
        asc(shippingRatesTable.minAmountCfa),
        asc(shippingRatesTable.id)
      );
    return rows.map(mapShippingRateRow);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  const zone = await getDeliveryZoneById(zoneId);
  if (!zone) return [];
  return [
    {
      id: 0,
      zoneId,
      label: "Standard",
      minAmountCfa: 0,
      maxAmountCfa: null,
      feeCfa: Number(zone.deliveryFee || 0),
      etaMinHours: Math.max(12, Number(zone.deliveryDays || 1) * 24),
      etaMaxHours: Math.max(24, Number(zone.deliveryDays || 1) * 24 + 24),
      isActive: Boolean(zone.isActive),
      createdAt: toIso(zone.createdAt) || new Date().toISOString(),
      updatedAt: toIso(zone.updatedAt) || new Date().toISOString(),
    },
  ];
}

export async function createShippingRate(
  input: ShippingRateCreate
): Promise<ShippingRate> {
  const db = await getDb();
  if (!db) {
    const now = new Date();
    const created = {
      id: demoShippingRateIdSeq++,
      zoneId: input.zoneId,
      label: input.label,
      minAmountCfa: input.minAmountCfa,
      maxAmountCfa: input.maxAmountCfa ?? null,
      feeCfa: input.feeCfa,
      etaMinHours: input.etaMinHours,
      etaMaxHours: input.etaMaxHours,
      isActive: input.isActive,
      createdAt: now,
      updatedAt: now,
    };
    demoShippingRates.push(created);
    await syncZoneSnapshotFromRates(input.zoneId);
    return mapShippingRateRow(created);
  }

  const { shippingRates: shippingRatesTable } =
    await import("../drizzle/schema");
  const result = await db.insert(shippingRatesTable).values({
    zoneId: input.zoneId,
    label: input.label,
    minAmountCfa: input.minAmountCfa,
    maxAmountCfa: input.maxAmountCfa ?? null,
    feeCfa: input.feeCfa,
    etaMinHours: input.etaMinHours,
    etaMaxHours: input.etaMaxHours,
    isActive: input.isActive,
  });
  const rateId = Number(result[0]?.insertId || 0);
  if (!rateId) {
    throw new Error("Failed to create shipping rate");
  }
  const rows = await db
    .select()
    .from(shippingRatesTable)
    .where(eq(shippingRatesTable.id, rateId))
    .limit(1);
  if (!rows[0]) {
    throw new Error("Failed to reload shipping rate");
  }
  await syncZoneSnapshotFromRates(Number(rows[0].zoneId));
  return mapShippingRateRow(rows[0]);
}

export async function updateShippingRate(
  id: number,
  input: ShippingRateUpdate
): Promise<ShippingRate | null> {
  const db = await getDb();
  if (!db) {
    const target = demoShippingRates.find(item => item.id === id);
    if (!target) return null;
    if (input.label !== undefined) target.label = input.label;
    if (input.minAmountCfa !== undefined)
      target.minAmountCfa = input.minAmountCfa;
    if (input.maxAmountCfa !== undefined)
      target.maxAmountCfa = input.maxAmountCfa;
    if (input.feeCfa !== undefined) target.feeCfa = input.feeCfa;
    if (input.etaMinHours !== undefined) target.etaMinHours = input.etaMinHours;
    if (input.etaMaxHours !== undefined) target.etaMaxHours = input.etaMaxHours;
    if (input.isActive !== undefined) target.isActive = input.isActive;
    target.updatedAt = new Date();
    await syncZoneSnapshotFromRates(target.zoneId);
    return mapShippingRateRow(target);
  }

  const { shippingRates: shippingRatesTable } =
    await import("../drizzle/schema");
  const current = await db
    .select()
    .from(shippingRatesTable)
    .where(eq(shippingRatesTable.id, id))
    .limit(1);
  if (!current[0]) return null;

  const payload: Partial<typeof shippingRatesTable.$inferInsert> = {};
  if (input.label !== undefined) payload.label = input.label;
  if (input.minAmountCfa !== undefined)
    payload.minAmountCfa = input.minAmountCfa;
  if (input.maxAmountCfa !== undefined)
    payload.maxAmountCfa = input.maxAmountCfa;
  if (input.feeCfa !== undefined) payload.feeCfa = input.feeCfa;
  if (input.etaMinHours !== undefined) payload.etaMinHours = input.etaMinHours;
  if (input.etaMaxHours !== undefined) payload.etaMaxHours = input.etaMaxHours;
  if (input.isActive !== undefined) payload.isActive = input.isActive;

  if (Object.keys(payload).length > 0) {
    await db
      .update(shippingRatesTable)
      .set(payload as any)
      .where(eq(shippingRatesTable.id, id));
  }

  const updatedRows = await db
    .select()
    .from(shippingRatesTable)
    .where(eq(shippingRatesTable.id, id))
    .limit(1);
  if (!updatedRows[0]) return null;
  await syncZoneSnapshotFromRates(Number(updatedRows[0].zoneId));
  return mapShippingRateRow(updatedRows[0]);
}

export async function deleteShippingRate(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const target = demoShippingRates.find(item => item.id === id);
    if (!target) return false;
    const zoneId = target.zoneId;
    const next = demoShippingRates.filter(item => item.id !== id);
    demoShippingRates.splice(0, demoShippingRates.length, ...next);
    await syncZoneSnapshotFromRates(zoneId);
    return true;
  }

  const { shippingRates: shippingRatesTable } =
    await import("../drizzle/schema");
  const existing = await db
    .select()
    .from(shippingRatesTable)
    .where(eq(shippingRatesTable.id, id))
    .limit(1);
  if (!existing[0]) return false;
  const zoneId = Number(existing[0].zoneId);
  await db.delete(shippingRatesTable).where(eq(shippingRatesTable.id, id));
  await syncZoneSnapshotFromRates(zoneId);
  return true;
}

// ─── Customers ───

export async function getOrCreateCustomer(
  name: string,
  phone: string,
  email?: string,
  address?: string,
  city?: string
) {
  const db = await getDb();
  if (!db) return null;
  const { customers: customersTable } = await import("../drizzle/schema");
  const existing = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.phone, phone))
    .limit(1);
  if (existing.length > 0) {
    const current = existing[0];
    const updates: Record<string, unknown> = {};
    if (name?.trim() && name !== current.name) updates.name = name;
    if (email?.trim() && email !== current.email) updates.email = email;
    if (address?.trim() && address !== current.address)
      updates.address = address;
    if (city?.trim() && city !== current.city) updates.city = city;

    if (Object.keys(updates).length > 0) {
      await db
        .update(customersTable)
        .set(updates as any)
        .where(eq(customersTable.id, current.id));
    }

    return { ...current, ...updates };
  }
  await db.insert(customersTable).values({ name, phone, email, address, city });
  const created = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.phone, phone))
    .limit(1);
  return created[0] ?? null;
}

export async function getCustomerByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  const { customers: customersTable } = await import("../drizzle/schema");
  const rows = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.phone, phone))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCustomers(
  opts: { query?: string; limit?: number; offset?: number } = {}
) {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 50));
  const offset = Math.max(0, opts.offset ?? 0);
  const trimmedQuery = opts.query?.trim();
  const db = await getDb();
  if (!db) {
    return { items: [] as any[], total: 0 };
  }
  const { customers: customersTable } = await import("../drizzle/schema");
  const conditions: any[] = [];
  if (trimmedQuery) {
    const pattern = `%${trimmedQuery}%`;
    conditions.push(
      or(
        like(customersTable.name, pattern),
        like(customersTable.phone, pattern),
        like(customersTable.email, pattern)
      )!
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(customersTable)
      .where(where)
      .orderBy(desc(customersTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(customersTable).where(where),
  ]);
  return {
    items: rows,
    total: Number(countRows[0]?.count || 0),
  };
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { customers: customersTable } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, id))
    .limit(1);
  return result[0];
}

// ─── Activity Logs ───
export async function logActivity(
  adminId: number,
  action: string,
  entityType: string,
  entityId: number,
  description?: string,
  oldValues?: any,
  newValues?: any
) {
  const db = await getDb();
  if (!db) return;
  const { activityLogs: activityLogsTable } = await import("../drizzle/schema");
  await db.insert(activityLogsTable).values({
    adminId,
    action,
    entityType,
    entityId,
    description,
    oldValues: oldValues ? JSON.stringify(oldValues) : null,
    newValues: newValues ? JSON.stringify(newValues) : null,
  });
}

export async function getActivityLogs(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  const { activityLogs: activityLogsTable } = await import("../drizzle/schema");
  return db
    .select()
    .from(activityLogsTable)
    .orderBy(desc(activityLogsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

export type WriteAuditLogInput = {
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

function parseAuditPayload(value: string | null | undefined): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function writeAuditLog(input: WriteAuditLogInput) {
  const payload: AuditLogItem = {
    id: demoAuditLogIdSeq,
    actorUserId: input.actorUserId ?? null,
    actorName: null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId == null ? null : String(input.entityId),
    beforeJson: input.beforeJson ?? null,
    afterJson: input.afterJson ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: new Date().toISOString(),
  };

  const db = await getDb();
  if (!db) {
    demoAuditLogs.unshift({
      ...payload,
      id: demoAuditLogIdSeq++,
    });
    return;
  }

  try {
    const { auditLogs: auditLogsTable } = await import("../drizzle/schema");
    await db.insert(auditLogsTable).values({
      actorUserId: payload.actorUserId,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId,
      beforeJson:
        payload.beforeJson == null ? null : JSON.stringify(payload.beforeJson),
      afterJson:
        payload.afterJson == null ? null : JSON.stringify(payload.afterJson),
      ip: payload.ip,
      userAgent: payload.userAgent,
    });
    return;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  if (payload.actorUserId != null) {
    await logActivity(
      payload.actorUserId,
      payload.action,
      payload.entityType,
      Number(payload.entityId || 0),
      undefined,
      payload.beforeJson,
      payload.afterJson
    );
  }
}

export async function listAuditLogsByCursor(input: {
  limit?: number;
  cursor?: number;
  action?: string;
  entityType?: string;
}): Promise<AuditLogListResponse> {
  const limit = Math.min(200, Math.max(1, Math.floor(input.limit || 50)));
  const db = await getDb();

  if (!db) {
    let rows = [...demoAuditLogs];
    if (input.cursor) {
      rows = rows.filter(row => row.id < input.cursor!);
    }
    if (input.action) {
      rows = rows.filter(row =>
        row.action.toLowerCase().includes(input.action!.toLowerCase())
      );
    }
    if (input.entityType) {
      rows = rows.filter(row =>
        row.entityType.toLowerCase().includes(input.entityType!.toLowerCase())
      );
    }
    rows.sort((left, right) => right.id - left.id);
    const sliced = rows.slice(0, limit + 1);
    const hasMore = sliced.length > limit;
    const items = sliced.slice(0, limit);
    return {
      items,
      nextCursor:
        hasMore && items.length > 0 ? items[items.length - 1].id : null,
    };
  }

  try {
    const { auditLogs: auditLogsTable } = await import("../drizzle/schema");
    const conditions = [];
    if (input.cursor) {
      conditions.push(lt(auditLogsTable.id, input.cursor));
    }
    if (input.action) {
      conditions.push(like(auditLogsTable.action, `%${input.action}%`));
    }
    if (input.entityType) {
      conditions.push(like(auditLogsTable.entityType, `%${input.entityType}%`));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: auditLogsTable.id,
        actorUserId: auditLogsTable.actorUserId,
        actorName: users.name,
        action: auditLogsTable.action,
        entityType: auditLogsTable.entityType,
        entityId: auditLogsTable.entityId,
        beforeJson: auditLogsTable.beforeJson,
        afterJson: auditLogsTable.afterJson,
        ip: auditLogsTable.ip,
        userAgent: auditLogsTable.userAgent,
        createdAt: auditLogsTable.createdAt,
      })
      .from(auditLogsTable)
      .leftJoin(users, eq(auditLogsTable.actorUserId, users.id))
      .where(where)
      .orderBy(desc(auditLogsTable.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const sliced = rows.slice(0, limit);
    return {
      items: sliced.map(row => ({
        id: Number(row.id),
        actorUserId: row.actorUserId == null ? null : Number(row.actorUserId),
        actorName: row.actorName ? String(row.actorName) : null,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId ?? null,
        beforeJson: parseAuditPayload(row.beforeJson),
        afterJson: parseAuditPayload(row.afterJson),
        ip: row.ip ?? null,
        userAgent: row.userAgent ?? null,
        createdAt: toIso(row.createdAt) || new Date().toISOString(),
      })),
      nextCursor:
        hasMore && sliced.length > 0
          ? Number(sliced[sliced.length - 1].id)
          : null,
    };
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  const rows = await getActivityLogs(limit, 0);
  return {
    items: rows.map((row: any) => ({
      id: Number(row.id),
      actorUserId: Number(row.adminId),
      actorName: null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId == null ? null : String(row.entityId),
      beforeJson: parseAuditPayload(row.oldValues),
      afterJson: parseAuditPayload(row.newValues),
      ip: null,
      userAgent: null,
      createdAt: toIso(row.createdAt) || new Date().toISOString(),
    })),
    nextCursor: null,
  };
}

// ─── Store Settings ───
function getDefaultSettingsStore(): SettingsStore {
  return {
    name: demoStoreSettings.get("store.name") || "SenBonsPlans",
    logoUrl: demoStoreSettings.get("store.logo") || "",
    phone: demoStoreSettings.get("store.contact") || "",
    email: demoStoreSettings.get("store.email") || "",
    address: demoStoreSettings.get("store.address") || "",
    currency: demoStoreSettings.get("store.currency") || "CFA",
    socials: {},
  };
}

function getDefaultSettingsPayments(): SettingsPayments {
  return {
    waveEnabled: parseSettingsBoolean(
      demoStoreSettings.get("payments.waveEnabled"),
      true
    ),
    omEnabled: parseSettingsBoolean(
      demoStoreSettings.get("payments.orangeEnabled"),
      true
    ),
    cardEnabled: parseSettingsBoolean(
      demoStoreSettings.get("payments.cardEnabled"),
      false
    ),
    waveKey: demoStoreSettings.get("payments.waveConfig") || "",
    omKey: demoStoreSettings.get("payments.orangeConfig") || "",
    cardPublicKey: demoStoreSettings.get("payments.cardConfig") || "",
    cardSecretKey: "",
  };
}

function parseChatbotPolicies(
  value: string | null | undefined
): AdminChatbotSettings["policies"] {
  if (!value) return { ...defaultAdminChatbotSettings.policies };
  try {
    const parsed = JSON.parse(value) as Partial<
      AdminChatbotSettings["policies"]
    >;
    return {
      return:
        typeof parsed?.return === "string" && parsed.return.trim().length > 0
          ? parsed.return.trim()
          : defaultAdminChatbotSettings.policies.return,
      delivery:
        typeof parsed?.delivery === "string" &&
        parsed.delivery.trim().length > 0
          ? parsed.delivery.trim()
          : defaultAdminChatbotSettings.policies.delivery,
      payment:
        typeof parsed?.payment === "string" && parsed.payment.trim().length > 0
          ? parsed.payment.trim()
          : defaultAdminChatbotSettings.policies.payment,
    };
  } catch {
    return { ...defaultAdminChatbotSettings.policies };
  }
}

export async function getAdminChatbotSettings(): Promise<AdminChatbotSettings> {
  const db = await getDb();
  if (!db) {
    return {
      ...demoAdminChatbotSettings,
      policies: { ...demoAdminChatbotSettings.policies },
    };
  }

  try {
    const rows = await db
      .select()
      .from(adminChatSettings)
      .where(eq(adminChatSettings.id, 1))
      .limit(1);
    const row = rows[0];
    if (!row) {
      await db.insert(adminChatSettings).values({
        id: 1,
        greeting: defaultAdminChatbotSettings.greeting,
        tone: defaultAdminChatbotSettings.tone,
        whatsappNumber: defaultAdminChatbotSettings.whatsappNumber,
        policies: JSON.stringify(defaultAdminChatbotSettings.policies),
      });
      return {
        ...defaultAdminChatbotSettings,
        policies: { ...defaultAdminChatbotSettings.policies },
      };
    }

    return {
      id: Number(row.id),
      greeting:
        typeof row.greeting === "string" && row.greeting.trim().length > 0
          ? row.greeting
          : defaultAdminChatbotSettings.greeting,
      tone:
        row.tone === "Friendly" ||
        row.tone === "Professional" ||
        row.tone === "Luxury skincare"
          ? row.tone
          : defaultAdminChatbotSettings.tone,
      whatsappNumber:
        typeof row.whatsappNumber === "string" &&
        row.whatsappNumber.trim().length > 0
          ? row.whatsappNumber
          : defaultAdminChatbotSettings.whatsappNumber,
      policies: parseChatbotPolicies(row.policies),
      updatedAt: toIso(row.updatedAt) || new Date().toISOString(),
    };
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return {
      ...demoAdminChatbotSettings,
      policies: { ...demoAdminChatbotSettings.policies },
    };
  }
}

export async function updateAdminChatbotSettings(
  input: AdminChatbotSettingsUpdate
): Promise<AdminChatbotSettings> {
  const current = await getAdminChatbotSettings();
  const next: AdminChatbotSettings = {
    ...current,
    ...input,
    policies: input.policies ? { ...input.policies } : { ...current.policies },
    updatedAt: new Date().toISOString(),
  };

  const db = await getDb();
  if (!db) {
    demoAdminChatbotSettings = {
      ...next,
      policies: { ...next.policies },
    };
    return {
      ...demoAdminChatbotSettings,
      policies: { ...demoAdminChatbotSettings.policies },
    };
  }

  try {
    const existing = await db
      .select()
      .from(adminChatSettings)
      .where(eq(adminChatSettings.id, 1))
      .limit(1);

    const payload = {
      greeting: next.greeting,
      tone: next.tone,
      whatsappNumber: next.whatsappNumber,
      policies: JSON.stringify(next.policies),
    };

    if (existing[0]) {
      await db
        .update(adminChatSettings)
        .set(payload)
        .where(eq(adminChatSettings.id, 1));
    } else {
      await db.insert(adminChatSettings).values({
        id: 1,
        ...payload,
      });
    }
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    demoAdminChatbotSettings = {
      ...next,
      policies: { ...next.policies },
    };
  }

  return getAdminChatbotSettings();
}

export async function getAdminSettingsStore(): Promise<SettingsStore> {
  const defaults = getDefaultSettingsStore();
  const db = await getDb();
  if (!db) return defaults;

  try {
    const { settingsStore: settingsStoreTable } =
      await import("../drizzle/schema");
    const rows = await db
      .select()
      .from(settingsStoreTable)
      .orderBy(asc(settingsStoreTable.id))
      .limit(1);
    if (rows[0]) {
      return {
        name: rows[0].name || defaults.name,
        logoUrl: rows[0].logoUrl || "",
        phone: rows[0].phone || "",
        email: rows[0].email || "",
        address: rows[0].address || "",
        currency: rows[0].currency || defaults.currency,
        socials: parseJsonObject(rows[0].socials),
      };
    }
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  const rows = await listStoreSettings("store.");
  const map = new Map(rows.map(item => [item.key, item.value || ""]));
  return {
    name: map.get("store.name") || defaults.name,
    logoUrl: map.get("store.logo") || "",
    phone: map.get("store.contact") || "",
    email: map.get("store.email") || "",
    address: map.get("store.address") || "",
    currency: map.get("store.currency") || defaults.currency,
    socials: {},
  };
}

export async function updateAdminSettingsStore(
  input: SettingsStoreUpdate
): Promise<SettingsStore> {
  const current = await getAdminSettingsStore();
  const next: SettingsStore = {
    ...current,
    ...input,
    socials: input.socials ? { ...input.socials } : current.socials,
  };

  const db = await getDb();
  if (db) {
    try {
      const { settingsStore: settingsStoreTable } =
        await import("../drizzle/schema");
      const rows = await db
        .select()
        .from(settingsStoreTable)
        .orderBy(asc(settingsStoreTable.id))
        .limit(1);
      const payload = {
        name: next.name,
        logoUrl: normalizeOptionalText(next.logoUrl) || "",
        phone: normalizeOptionalText(next.phone) || "",
        email: normalizeOptionalText(next.email) || "",
        address: normalizeOptionalText(next.address) || "",
        currency: normalizeOptionalText(next.currency) || "CFA",
        socials: JSON.stringify(next.socials || {}),
      };
      if (rows[0]) {
        await db
          .update(settingsStoreTable)
          .set(payload)
          .where(eq(settingsStoreTable.id, rows[0].id));
      } else {
        await db.insert(settingsStoreTable).values(payload);
      }
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }
  }

  await Promise.all([
    setStoreSetting("store.name", next.name),
    setStoreSetting("store.logo", next.logoUrl),
    setStoreSetting("store.contact", next.phone),
    setStoreSetting("store.email", next.email),
    setStoreSetting("store.address", next.address),
    setStoreSetting("store.currency", next.currency),
  ]);

  return getAdminSettingsStore();
}

export async function getAdminSettingsPayments(): Promise<SettingsPayments> {
  const defaults = getDefaultSettingsPayments();
  const db = await getDb();
  if (!db) return defaults;

  try {
    const { settingsPayments: settingsPaymentsTable } =
      await import("../drizzle/schema");
    const rows = await db
      .select()
      .from(settingsPaymentsTable)
      .orderBy(asc(settingsPaymentsTable.id))
      .limit(1);
    if (rows[0]) {
      return {
        waveEnabled: Boolean(rows[0].waveEnabled),
        omEnabled: Boolean(rows[0].omEnabled),
        cardEnabled: Boolean(rows[0].cardEnabled),
        waveKey: rows[0].waveKey || "",
        omKey: rows[0].omKey || "",
        cardPublicKey: rows[0].cardPublicKey || "",
        cardSecretKey: rows[0].cardSecretKey || "",
      };
    }
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  const rows = await listStoreSettings("payments.");
  const map = new Map(rows.map(item => [item.key, item.value || ""]));
  return {
    waveEnabled: parseSettingsBoolean(
      map.get("payments.waveEnabled"),
      defaults.waveEnabled
    ),
    omEnabled: parseSettingsBoolean(
      map.get("payments.orangeEnabled"),
      defaults.omEnabled
    ),
    cardEnabled: parseSettingsBoolean(
      map.get("payments.cardEnabled"),
      defaults.cardEnabled
    ),
    waveKey: map.get("payments.waveConfig") || "",
    omKey: map.get("payments.orangeConfig") || "",
    cardPublicKey: map.get("payments.cardConfig") || "",
    cardSecretKey: "",
  };
}

export async function updateAdminSettingsPayments(
  input: SettingsPaymentsUpdate
): Promise<SettingsPayments> {
  const current = await getAdminSettingsPayments();
  const next: SettingsPayments = { ...current, ...input };

  const db = await getDb();
  if (db) {
    try {
      const { settingsPayments: settingsPaymentsTable } =
        await import("../drizzle/schema");
      const rows = await db
        .select()
        .from(settingsPaymentsTable)
        .orderBy(asc(settingsPaymentsTable.id))
        .limit(1);
      const payload = {
        waveEnabled: next.waveEnabled,
        omEnabled: next.omEnabled,
        cardEnabled: next.cardEnabled,
        waveKey: normalizeOptionalText(next.waveKey) || "",
        omKey: normalizeOptionalText(next.omKey) || "",
        cardPublicKey: normalizeOptionalText(next.cardPublicKey) || "",
        cardSecretKey: normalizeOptionalText(next.cardSecretKey) || "",
      };
      if (rows[0]) {
        await db
          .update(settingsPaymentsTable)
          .set(payload)
          .where(eq(settingsPaymentsTable.id, rows[0].id));
      } else {
        await db.insert(settingsPaymentsTable).values(payload);
      }
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }
  }

  await Promise.all([
    setStoreSetting("payments.waveEnabled", String(next.waveEnabled)),
    setStoreSetting("payments.orangeEnabled", String(next.omEnabled)),
    setStoreSetting("payments.cardEnabled", String(next.cardEnabled)),
    setStoreSetting("payments.waveConfig", next.waveKey),
    setStoreSetting("payments.orangeConfig", next.omKey),
    setStoreSetting("payments.cardConfig", next.cardPublicKey),
  ]);

  return getAdminSettingsPayments();
}

export async function getStoreSetting(key: string) {
  const db = await getDb();
  if (!db) return demoStoreSettings.get(key) ?? null;
  const { storeSettings: storeSettingsTable } =
    await import("../drizzle/schema");
  const result = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.key, key))
    .limit(1);
  return result[0]?.value;
}

export async function listStoreSettings(prefix?: string) {
  const db = await getDb();
  if (!db) {
    return Array.from(demoStoreSettings.entries())
      .filter(([key]) => !prefix || key.startsWith(prefix))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => ({ key, value }));
  }
  const { storeSettings: storeSettingsTable } =
    await import("../drizzle/schema");

  const rows = prefix
    ? await db
        .select()
        .from(storeSettingsTable)
        .where(like(storeSettingsTable.key, `${prefix}%`))
        .orderBy(asc(storeSettingsTable.key))
    : await db
        .select()
        .from(storeSettingsTable)
        .orderBy(asc(storeSettingsTable.key));

  return rows.map(item => ({ key: item.key, value: item.value ?? "" }));
}

export type StorefrontSettings = {
  storeName: string;
  storeLogo: string;
  storeContact: string;
  storeCurrency: string;
  supportEmail: string;
  footerAddress: string;
  deliveryText: string;
  paymentMethodsText: string;
  promoActive: boolean;
  promoKicker: string;
  promoTitle: string;
  promoSubtitle: string;
  promoLinkLabel: string;
  promoLinkHref: string;
  paymentWaveEnabled: boolean;
  paymentOrangeEnabled: boolean;
  paymentFreeMoneyEnabled: boolean;
  paymentCardEnabled: boolean;
};

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  const defaults: StorefrontSettings = {
    storeName: "SenBonsPlans",
    storeLogo: "",
    storeContact: "+221 78 891 10 10",
    storeCurrency: "CFA",
    supportEmail: "contact@senbonsplans.com",
    footerAddress: "Dakar, Senegal",
    deliveryText: "Expedition a Dakar et regions en 24h/72h.",
    paymentMethodsText: "Wave, Orange Money, Free Money, Visa, Mastercard",
    promoActive: true,
    promoKicker: "Promo de la semaine",
    promoTitle: "Jusqu'a -40% sur une selection premium",
    promoSubtitle:
      "Activez les offres exclusives et augmentez le panier moyen avec des produits tendance.",
    promoLinkLabel: "Voir les promotions",
    promoLinkHref: "/boutique",
    paymentWaveEnabled: true,
    paymentOrangeEnabled: true,
    paymentFreeMoneyEnabled: true,
    paymentCardEnabled: false,
  };

  const [storeRows, promoRows, paymentRows] = await Promise.all([
    listStoreSettings("store."),
    listStoreSettings("promo."),
    listStoreSettings("payments."),
  ]);
  const map = new Map(
    [...storeRows, ...promoRows, ...paymentRows].map(item => [
      item.key,
      item.value || "",
    ])
  );
  const promoActiveRaw = (map.get("promo.active") || "").toLowerCase();
  const promoActive = promoActiveRaw
    ? promoActiveRaw === "true"
    : defaults.promoActive;
  const parseToggle = (key: string, fallback: boolean) => {
    const raw = (map.get(key) || "").trim().toLowerCase();
    if (!raw) return fallback;
    return raw === "true";
  };

  return {
    storeName: map.get("store.name") || defaults.storeName,
    storeLogo: map.get("store.logo") || defaults.storeLogo,
    storeContact: map.get("store.contact") || defaults.storeContact,
    storeCurrency: map.get("store.currency") || defaults.storeCurrency,
    supportEmail: map.get("store.email") || defaults.supportEmail,
    footerAddress: map.get("store.address") || defaults.footerAddress,
    deliveryText: map.get("store.deliveryText") || defaults.deliveryText,
    paymentMethodsText:
      map.get("store.paymentMethodsText") || defaults.paymentMethodsText,
    promoActive,
    promoKicker: map.get("promo.kicker") || defaults.promoKicker,
    promoTitle: map.get("promo.title") || defaults.promoTitle,
    promoSubtitle: map.get("promo.subtitle") || defaults.promoSubtitle,
    promoLinkLabel: map.get("promo.linkLabel") || defaults.promoLinkLabel,
    promoLinkHref: map.get("promo.linkHref") || defaults.promoLinkHref,
    paymentWaveEnabled: parseToggle(
      "payments.waveEnabled",
      defaults.paymentWaveEnabled
    ),
    paymentOrangeEnabled: parseToggle(
      "payments.orangeEnabled",
      defaults.paymentOrangeEnabled
    ),
    paymentFreeMoneyEnabled: parseToggle(
      "payments.freeMoneyEnabled",
      defaults.paymentFreeMoneyEnabled
    ),
    paymentCardEnabled: parseToggle(
      "payments.cardEnabled",
      defaults.paymentCardEnabled
    ),
  };
}

export async function setStoreSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) {
    demoStoreSettings.set(key, value);
    return;
  }
  const { storeSettings: storeSettingsTable } =
    await import("../drizzle/schema");
  await db
    .insert(storeSettingsTable)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

export type CmsResultsSectionPayload = {
  id: number;
  enabled: boolean;
  title: string;
  subtitle: string;
  beforeLabel: string;
  afterLabel: string;
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
  stat1Value: string;
  stat1Title: string;
  stat1Desc: string;
  stat2Value: string;
  stat2Title: string;
  stat2Desc: string;
  stat3Value: string;
  stat3Title: string;
  stat3Desc: string;
  footerNote: string;
  updatedAt: string;
};

export type CmsResultsSectionUpdateInput = Partial<
  Omit<CmsResultsSectionPayload, "id" | "updatedAt">
>;

function mapCmsResultsSectionRow(row: any): CmsResultsSectionPayload {
  return {
    id: Number(row.id),
    enabled: Boolean(row.enabled),
    title: String(row.title || ""),
    subtitle: String(row.subtitle || ""),
    beforeLabel: String(row.beforeLabel || "AVANT"),
    afterLabel: String(row.afterLabel || "APRES"),
    beforeImageUrl: row.beforeImageUrl || null,
    afterImageUrl: row.afterImageUrl || null,
    stat1Value: String(row.stat1Value || ""),
    stat1Title: String(row.stat1Title || ""),
    stat1Desc: String(row.stat1Desc || ""),
    stat2Value: String(row.stat2Value || ""),
    stat2Title: String(row.stat2Title || ""),
    stat2Desc: String(row.stat2Desc || ""),
    stat3Value: String(row.stat3Value || ""),
    stat3Title: String(row.stat3Title || ""),
    stat3Desc: String(row.stat3Desc || ""),
    footerNote: String(row.footerNote || ""),
    updatedAt: new Date(row.updatedAt || new Date()).toISOString(),
  };
}

async function ensureCmsResultsSectionRow() {
  const db = await getDb();
  if (!db) return demoCmsResultsSectionRow;

  try {
    const existing = await db
      .select()
      .from(cmsResultsSection)
      .orderBy(desc(cmsResultsSection.id))
      .limit(1);

    if (existing[0]) return existing[0];

    await db
      .insert(cmsResultsSection)
      .values(defaultCmsResultsSectionSeed as any);

    const created = await db
      .select()
      .from(cmsResultsSection)
      .orderBy(desc(cmsResultsSection.id))
      .limit(1);

    if (!created[0]) {
      throw new Error("Failed to initialize cms_results_section");
    }

    return created[0];
  } catch (error) {
    if (isMissingTableError(error)) {
      return demoCmsResultsSectionRow;
    }
    throw error;
  }
}

export async function getCmsResultsSection(): Promise<CmsResultsSectionPayload> {
  const db = await getDb();
  if (!db) {
    return mapCmsResultsSectionRow(demoCmsResultsSectionRow);
  }

  const row = await ensureCmsResultsSectionRow();
  return mapCmsResultsSectionRow(row);
}

export async function updateCmsResultsSection(
  data: CmsResultsSectionUpdateInput
): Promise<CmsResultsSectionPayload> {
  const db = await getDb();
  if (!db) {
    demoCmsResultsSectionRow = {
      ...demoCmsResultsSectionRow,
      ...data,
      updatedAt: new Date(),
    };
    return mapCmsResultsSectionRow(demoCmsResultsSectionRow);
  }

  try {
    const current = await ensureCmsResultsSectionRow();
    const payload: Record<string, unknown> = {};

    if (data.enabled !== undefined) payload.enabled = data.enabled;
    if (data.title !== undefined) payload.title = data.title;
    if (data.subtitle !== undefined) payload.subtitle = data.subtitle;
    if (data.beforeLabel !== undefined) payload.beforeLabel = data.beforeLabel;
    if (data.afterLabel !== undefined) payload.afterLabel = data.afterLabel;
    if (data.beforeImageUrl !== undefined)
      payload.beforeImageUrl = data.beforeImageUrl;
    if (data.afterImageUrl !== undefined)
      payload.afterImageUrl = data.afterImageUrl;
    if (data.stat1Value !== undefined) payload.stat1Value = data.stat1Value;
    if (data.stat1Title !== undefined) payload.stat1Title = data.stat1Title;
    if (data.stat1Desc !== undefined) payload.stat1Desc = data.stat1Desc;
    if (data.stat2Value !== undefined) payload.stat2Value = data.stat2Value;
    if (data.stat2Title !== undefined) payload.stat2Title = data.stat2Title;
    if (data.stat2Desc !== undefined) payload.stat2Desc = data.stat2Desc;
    if (data.stat3Value !== undefined) payload.stat3Value = data.stat3Value;
    if (data.stat3Title !== undefined) payload.stat3Title = data.stat3Title;
    if (data.stat3Desc !== undefined) payload.stat3Desc = data.stat3Desc;
    if (data.footerNote !== undefined) payload.footerNote = data.footerNote;

    if (Object.keys(payload).length > 0) {
      await db
        .update(cmsResultsSection)
        .set(payload as any)
        .where(eq(cmsResultsSection.id, Number(current.id)));
    }

    const updated = await db
      .select()
      .from(cmsResultsSection)
      .where(eq(cmsResultsSection.id, Number(current.id)))
      .limit(1);

    if (!updated[0]) {
      throw new Error("Failed to reload cms_results_section after update");
    }

    return mapCmsResultsSectionRow(updated[0]);
  } catch (error) {
    if (isMissingTableError(error)) {
      demoCmsResultsSectionRow = {
        ...demoCmsResultsSectionRow,
        ...data,
        updatedAt: new Date(),
      };
      return mapCmsResultsSectionRow(demoCmsResultsSectionRow);
    }
    throw error;
  }
}

export type CmsEditorialHeroCardPosition = "left" | "center" | "right";

export type CmsEditorialHeroPayload = {
  id: number;
  isActive: boolean;
  badgeText: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  backgroundImageUrl: string;
  overlayOpacity: number;
  cardPosition: CmsEditorialHeroCardPosition;
  updatedAt: string;
};

export type CmsEditorialHeroUpdateInput = Partial<
  Omit<CmsEditorialHeroPayload, "id" | "updatedAt">
>;

function normalizeEditorialHeroOverlayOpacity(value: unknown, fallback = 55) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(90, Math.round(numeric)));
}

function normalizeEditorialHeroCardPosition(
  value: unknown,
  fallback: CmsEditorialHeroCardPosition = "left"
): CmsEditorialHeroCardPosition {
  if (value === "left" || value === "center" || value === "right") {
    return value;
  }
  return fallback;
}

function mapCmsEditorialHeroRow(row: any): CmsEditorialHeroPayload {
  return {
    id: Number(row.id || 1),
    isActive: Boolean(row.isActive),
    badgeText: String(row.badgeText || ""),
    title: String(row.title || ""),
    subtitle: String(row.subtitle || ""),
    ctaText: String(row.ctaText || ""),
    ctaLink: String(row.ctaLink || ""),
    backgroundImageUrl: String(row.backgroundImageUrl || ""),
    overlayOpacity: normalizeEditorialHeroOverlayOpacity(
      row.overlayOpacity,
      55
    ),
    cardPosition: normalizeEditorialHeroCardPosition(row.cardPosition),
    updatedAt: new Date(row.updatedAt || new Date()).toISOString(),
  };
}

async function ensureCmsEditorialHeroRow() {
  const db = await getDb();
  if (!db) return demoCmsEditorialHeroRow;

  try {
    const existing = await db
      .select()
      .from(cmsEditorialHero)
      .where(eq(cmsEditorialHero.id, 1))
      .limit(1);

    if (existing[0]) return existing[0];

    await db
      .insert(cmsEditorialHero)
      .values(defaultCmsEditorialHeroSeed as any);

    const created = await db
      .select()
      .from(cmsEditorialHero)
      .where(eq(cmsEditorialHero.id, 1))
      .limit(1);

    if (!created[0]) {
      throw new Error("Failed to initialize cms_editorial_hero");
    }

    return created[0];
  } catch (error) {
    if (isMissingTableError(error)) {
      return demoCmsEditorialHeroRow;
    }
    throw error;
  }
}

export async function getCmsEditorialHero(): Promise<CmsEditorialHeroPayload> {
  const db = await getDb();
  if (!db) {
    return mapCmsEditorialHeroRow(demoCmsEditorialHeroRow);
  }

  const row = await ensureCmsEditorialHeroRow();
  return mapCmsEditorialHeroRow(row);
}

export async function updateCmsEditorialHero(
  data: CmsEditorialHeroUpdateInput
): Promise<CmsEditorialHeroPayload> {
  const db = await getDb();
  if (!db) {
    demoCmsEditorialHeroRow = {
      ...demoCmsEditorialHeroRow,
      ...data,
      overlayOpacity:
        data.overlayOpacity === undefined
          ? demoCmsEditorialHeroRow.overlayOpacity
          : normalizeEditorialHeroOverlayOpacity(
              data.overlayOpacity,
              demoCmsEditorialHeroRow.overlayOpacity
            ),
      cardPosition:
        data.cardPosition === undefined
          ? demoCmsEditorialHeroRow.cardPosition
          : normalizeEditorialHeroCardPosition(
              data.cardPosition,
              demoCmsEditorialHeroRow.cardPosition
            ),
      updatedAt: new Date(),
    };
    return mapCmsEditorialHeroRow(demoCmsEditorialHeroRow);
  }

  try {
    const current = await ensureCmsEditorialHeroRow();
    const payload: Record<string, unknown> = {};

    if (data.isActive !== undefined) payload.isActive = data.isActive;
    if (data.badgeText !== undefined) payload.badgeText = data.badgeText;
    if (data.title !== undefined) payload.title = data.title;
    if (data.subtitle !== undefined) payload.subtitle = data.subtitle;
    if (data.ctaText !== undefined) payload.ctaText = data.ctaText;
    if (data.ctaLink !== undefined) payload.ctaLink = data.ctaLink;
    if (data.backgroundImageUrl !== undefined) {
      payload.backgroundImageUrl = data.backgroundImageUrl;
    }
    if (data.overlayOpacity !== undefined) {
      payload.overlayOpacity = normalizeEditorialHeroOverlayOpacity(
        data.overlayOpacity,
        55
      );
    }
    if (data.cardPosition !== undefined) {
      payload.cardPosition = normalizeEditorialHeroCardPosition(
        data.cardPosition,
        "left"
      );
    }

    if (Object.keys(payload).length > 0) {
      await db
        .update(cmsEditorialHero)
        .set(payload as any)
        .where(eq(cmsEditorialHero.id, Number(current.id)));
    }

    const updated = await db
      .select()
      .from(cmsEditorialHero)
      .where(eq(cmsEditorialHero.id, Number(current.id)))
      .limit(1);

    if (!updated[0]) {
      throw new Error("Failed to reload cms_editorial_hero after update");
    }

    return mapCmsEditorialHeroRow(updated[0]);
  } catch (error) {
    if (isMissingTableError(error)) {
      demoCmsEditorialHeroRow = {
        ...demoCmsEditorialHeroRow,
        ...data,
        overlayOpacity:
          data.overlayOpacity === undefined
            ? demoCmsEditorialHeroRow.overlayOpacity
            : normalizeEditorialHeroOverlayOpacity(
                data.overlayOpacity,
                demoCmsEditorialHeroRow.overlayOpacity
              ),
        cardPosition:
          data.cardPosition === undefined
            ? demoCmsEditorialHeroRow.cardPosition
            : normalizeEditorialHeroCardPosition(
                data.cardPosition,
                demoCmsEditorialHeroRow.cardPosition
              ),
        updatedAt: new Date(),
      };
      return mapCmsEditorialHeroRow(demoCmsEditorialHeroRow);
    }
    throw error;
  }
}

export async function listAdminUsers(limit = 100, offset = 0) {
  const safeLimit = Math.max(1, Math.floor(limit || 100));
  const safeOffset = Math.max(0, Math.floor(offset || 0));
  const db = await getDb();
  if (!db) {
    return [...demoAdminUsers]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )
      .slice(safeOffset, safeOffset + safeLimit)
      .map(entry => ({
        userId: entry.id,
        id: entry.id,
        name: entry.name,
        email: entry.email,
        phone: entry.phone,
        username: entry.username,
        loginMethod: entry.loginMethod,
        role: entry.role,
        userRole: mapAdminRoleToUserRole(entry.role),
        isActive: entry.isActive,
        createdAt: entry.createdAt,
        lastSignedIn: entry.lastLoginAt,
        lastLoginAt: entry.lastLoginAt,
      }));
  }
  const {
    staffAccounts: staffAccountsTable,
    adminCredentials: adminCredentialsTable,
  } = await import("../drizzle/schema");
  const [staffRows, credentialRows] = await Promise.all([
    db
      .select()
      .from(staffAccountsTable)
      .orderBy(desc(staffAccountsTable.updatedAt)),
    db
      .select({
        userId: adminCredentialsTable.userId,
        username: adminCredentialsTable.username,
        updatedAt: adminCredentialsTable.updatedAt,
      })
      .from(adminCredentialsTable)
      .orderBy(desc(adminCredentialsTable.updatedAt)),
  ]);

  const managedUserIds = new Set<number>();
  for (const row of staffRows) managedUserIds.add(Number(row.userId));
  for (const row of credentialRows) managedUserIds.add(Number(row.userId));
  const managedIdList = Array.from(managedUserIds).filter(
    id => Number.isFinite(id) && id > 0
  );

  const where =
    managedIdList.length > 0
      ? or(eq(users.role, "admin"), inArray(users.id, managedIdList))
      : eq(users.role, "admin");

  const usersRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      loginMethod: users.loginMethod,
      baseRole: users.role,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);

  const latestStaffByUserId = new Map<number, (typeof staffRows)[number]>();
  for (const row of staffRows) {
    if (!latestStaffByUserId.has(row.userId)) {
      latestStaffByUserId.set(row.userId, row);
    }
  }

  const usernameByUserId = new Map<number, string>();
  for (const row of credentialRows) {
    if (!usernameByUserId.has(Number(row.userId))) {
      usernameByUserId.set(Number(row.userId), row.username);
    }
  }

  return usersRows.map(userRow => {
    const staff = latestStaffByUserId.get(userRow.id);
    const effectiveRole =
      userRow.baseRole === "admin"
        ? "ADMIN"
        : staff && staff.isActive
          ? mapStaffRoleToAdminRole(staff.role)
          : "STAFF";
    const userRole = mapAdminRoleToUserRole(effectiveRole);

    return {
      userId: userRow.id,
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      phone: null,
      username: usernameByUserId.get(Number(userRow.id)) || null,
      loginMethod: userRow.loginMethod,
      role: effectiveRole,
      userRole,
      isActive: staff ? staff.isActive : userRow.baseRole === "admin",
      createdAt: userRow.createdAt,
      lastSignedIn: userRow.lastSignedIn,
      lastLoginAt: userRow.lastSignedIn,
    };
  });
}

function mapUserListEntryToAdminUser(entry: any): AdminUser {
  return {
    id: Number(entry.id || entry.userId),
    name: entry.name || `User #${entry.id || entry.userId}`,
    email: entry.email ?? null,
    phone: entry.phone ?? null,
    role: (entry.userRole ||
      mapAdminRoleToUserRole(entry.role || "STAFF")) as AdminUserRole,
    isActive: Boolean(entry.isActive),
    username: entry.username ?? null,
    createdAt: toIso(entry.createdAt) || new Date().toISOString(),
    lastLoginAt: toIso(entry.lastLoginAt || entry.lastSignedIn),
  };
}

export async function getAdminUserById(
  userId: number
): Promise<AdminUser | null> {
  const usersList = await listAdminUsers(5000, 0);
  const found = usersList.find(
    (entry: any) => Number(entry.id || entry.userId) === userId
  );
  return found ? mapUserListEntryToAdminUser(found) : null;
}

export async function createAdminPanelUser(
  input: AdminUserCreate & { passwordHash: string }
): Promise<AdminUser> {
  const db = await getDb();
  if (!db) {
    const normalizedUsername = input.username.trim().toLowerCase();
    const duplicate = demoAdminUsers.find(
      entry =>
        (entry.username || "").trim().toLowerCase() === normalizedUsername
    );
    if (duplicate) {
      throw new Error("Username already exists");
    }

    const now = new Date();
    const created: DemoAdminUserEntry = {
      id: demoAdminUserIdSeq++,
      name: input.name.trim(),
      email: normalizeOptionalText(input.email) || null,
      phone: normalizeOptionalText(input.phone),
      username: input.username.trim(),
      role: mapUserRoleToAdminRole(input.role),
      isActive: Boolean(input.isActive),
      loginMethod: "local_admin",
      createdAt: now,
      lastLoginAt: null,
    };
    demoAdminUsers.push(created);
    demoAdminPasswordHashes.set(created.id, input.passwordHash);

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      phone: created.phone,
      role: mapAdminRoleToUserRole(created.role),
      isActive: created.isActive,
      username: created.username,
      createdAt: created.createdAt.toISOString(),
      lastLoginAt: null,
    };
  }
  const {
    staffAccounts: staffAccountsTable,
    adminCredentials: adminCredentialsTable,
  } = await import("../drizzle/schema");

  const openId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const baseRole = input.role === "admin" ? "admin" : "user";
  const createdAt = new Date();
  const email = normalizeOptionalText(input.email) || null;

  const insertResult = await db.insert(users).values({
    openId,
    name: input.name,
    email,
    loginMethod: "local_admin",
    role: baseRole,
    lastSignedIn: createdAt,
  });
  const userId = Number(insertResult[0]?.insertId || 0);
  if (!userId) {
    throw new Error("Failed to create user");
  }

  const staffRole =
    input.role === "admin"
      ? "owner"
      : input.role === "manager"
        ? "manager"
        : "staff";
  await db.insert(staffAccountsTable).values({
    userId,
    role: staffRole as any,
    isActive: input.isActive,
  });

  await db.insert(adminCredentialsTable).values({
    userId,
    username: input.username,
    passwordHash: input.passwordHash,
  });

  const created = await getAdminUserById(userId);
  if (!created) {
    return {
      id: userId,
      name: input.name,
      email,
      phone: normalizeOptionalText(input.phone),
      role: input.role,
      isActive: input.isActive,
      username: input.username,
      createdAt: createdAt.toISOString(),
      lastLoginAt: null,
    };
  }
  return created;
}

export async function resetAdminUserPasswordHash(
  userId: number,
  passwordHash: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    const existing = demoAdminUsers.find(entry => entry.id === userId);
    if (!existing) {
      throw new Error("User not found");
    }
    demoAdminPasswordHashes.set(userId, passwordHash);
    return;
  }
  const { adminCredentials: adminCredentialsTable } =
    await import("../drizzle/schema");
  const existing = await db
    .select()
    .from(adminCredentialsTable)
    .where(eq(adminCredentialsTable.userId, userId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(adminCredentialsTable)
      .set({ passwordHash })
      .where(eq(adminCredentialsTable.id, existing[0].id));
    return;
  }

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    throw new Error("User not found");
  }

  const baseUsername =
    (user.email || `admin-${userId}`)
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 40) || `admin-${userId}`;
  let username = baseUsername;
  let attempt = 1;
  while (true) {
    const match = await db
      .select({ id: adminCredentialsTable.id })
      .from(adminCredentialsTable)
      .where(eq(adminCredentialsTable.username, username))
      .limit(1);
    if (!match[0]) break;
    attempt += 1;
    username = `${baseUsername}-${attempt}`;
  }

  await db.insert(adminCredentialsTable).values({
    userId,
    username,
    passwordHash,
  });
}

export async function updateAdminUserRole(
  userId: number,
  role: AdminRole,
  isActive = true
) {
  const db = await getDb();
  if (!db) {
    const target = demoAdminUsers.find(entry => entry.id === userId);
    if (!target) return;
    target.role = role;
    target.isActive = isActive;
    return;
  }
  const { staffAccounts: staffAccountsTable } =
    await import("../drizzle/schema");

  const existing = await db
    .select()
    .from(staffAccountsTable)
    .where(eq(staffAccountsTable.userId, userId))
    .orderBy(desc(staffAccountsTable.updatedAt))
    .limit(1);

  if (role === "ADMIN") {
    await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));
    const mappedRole = "owner";
    if (existing[0]) {
      await db
        .update(staffAccountsTable)
        .set({ role: mappedRole as any, isActive })
        .where(eq(staffAccountsTable.id, existing[0].id));
    } else {
      await db.insert(staffAccountsTable).values({
        userId,
        role: mappedRole as any,
        isActive,
      });
    }
    return;
  }

  await db.update(users).set({ role: "user" }).where(eq(users.id, userId));
  const mappedRole = role === "MANAGER" ? "manager" : "staff";
  if (existing[0]) {
    await db
      .update(staffAccountsTable)
      .set({ role: mappedRole as any, isActive })
      .where(eq(staffAccountsTable.id, existing[0].id));
  } else {
    await db.insert(staffAccountsTable).values({
      userId,
      role: mappedRole as any,
      isActive,
    });
  }
}

// â”€â”€â”€ CMS Pages â”€â”€â”€
export async function getCmsPages(
  opts: {
    search?: string;
    status?: "draft" | "published" | "all";
    limit?: number;
    offset?: number;
  } = {}
) {
  const db = await getDb();
  if (!db) {
    let rows = [...demoCmsPages];
    if (opts.status && opts.status !== "all") {
      rows = rows.filter(page => page.status === opts.status);
    }
    if (opts.search) {
      const query = opts.search.toLowerCase();
      rows = rows.filter(
        page =>
          page.title.toLowerCase().includes(query) ||
          page.slug.toLowerCase().includes(query) ||
          page.content.toLowerCase().includes(query)
      );
    }
    const sorted = rows.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const offset = opts.offset || 0;
    const limit = opts.limit || 50;
    return {
      pages: sorted.slice(offset, offset + limit),
      total: sorted.length,
    };
  }

  const { cmsPages: cmsPagesTable } = await import("../drizzle/schema");
  const conditions = [];
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(cmsPagesTable.status, opts.status as any));
  }
  if (opts.search) {
    conditions.push(
      or(
        like(cmsPagesTable.title, `%${opts.search}%`),
        like(cmsPagesTable.slug, `%${opts.search}%`),
        like(cmsPagesTable.content, `%${opts.search}%`)
      )
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [pages, countResult] = await Promise.all([
    db
      .select()
      .from(cmsPagesTable)
      .where(where)
      .orderBy(desc(cmsPagesTable.updatedAt))
      .limit(opts.limit || 50)
      .offset(opts.offset || 0),
    db.select({ count: count() }).from(cmsPagesTable).where(where),
  ]);

  return {
    pages,
    total: countResult[0]?.count || 0,
  };
}

export async function getCmsPageById(id: number) {
  const db = await getDb();
  if (!db) return demoCmsPages.find(page => page.id === id);
  const { cmsPages: cmsPagesTable } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(cmsPagesTable)
    .where(eq(cmsPagesTable.id, id))
    .limit(1);
  return result[0];
}

export async function createCmsPage(data: {
  title: string;
  slug: string;
  status?: "draft" | "published";
  content: string;
  seoTitle?: string;
  seoDescription?: string;
}) {
  const { sanitizeCmsHtml } = await import("./html-sanitizer");
  const safeContent = sanitizeCmsHtml(data.content);
  const db = await getDb();
  if (!db) {
    const page = {
      id: demoCmsPageIdSeq++,
      title: data.title,
      slug: data.slug,
      status: data.status || "draft",
      content: safeContent,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    demoCmsPages.unshift(page);
    return page.id;
  }
  const { cmsPages: cmsPagesTable } = await import("../drizzle/schema");
  const result = await db.insert(cmsPagesTable).values({
    title: data.title,
    slug: data.slug,
    status: (data.status || "draft") as any,
    content: safeContent,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
  });
  return result[0].insertId;
}

export async function updateCmsPage(
  id: number,
  data: Partial<{
    title: string;
    slug: string;
    status: "draft" | "published";
    content: string;
    seoTitle: string;
    seoDescription: string;
  }>
) {
  const { sanitizeCmsHtml } = await import("./html-sanitizer");
  const safeData =
    typeof data.content === "string"
      ? { ...data, content: sanitizeCmsHtml(data.content) }
      : data;

  const db = await getDb();
  if (!db) {
    const page = demoCmsPages.find(item => item.id === id);
    if (!page) throw new Error("CMS page not found");
    Object.assign(page, safeData, { updatedAt: new Date() });
    return;
  }
  const { cmsPages: cmsPagesTable } = await import("../drizzle/schema");
  await db
    .update(cmsPagesTable)
    .set(safeData as any)
    .where(eq(cmsPagesTable.id, id));
}

export async function deleteCmsPage(id: number) {
  const db = await getDb();
  if (!db) {
    const index = demoCmsPages.findIndex(item => item.id === id);
    if (index >= 0) demoCmsPages.splice(index, 1);
    return;
  }
  const { cmsPages: cmsPagesTable } = await import("../drizzle/schema");
  await db.delete(cmsPagesTable).where(eq(cmsPagesTable.id, id));
}

// ─── Order Notes ───
export async function addOrderNote(
  orderId: number,
  adminId: number,
  note: string,
  isInternal = true
) {
  const db = await getDb();
  if (!db) return;
  const { orderNotes: orderNotesTable } = await import("../drizzle/schema");
  await db
    .insert(orderNotesTable)
    .values({ orderId, adminId, note, isInternal });
}

export async function getOrderNotes(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  const { orderNotes: orderNotesTable } = await import("../drizzle/schema");
  return db
    .select()
    .from(orderNotesTable)
    .where(eq(orderNotesTable.orderId, orderId))
    .orderBy(desc(orderNotesTable.createdAt));
}

// ─── Low Stock Products ───
export async function getLowStockProducts(threshold = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(products)
    .where(
      and(eq(products.inStock, true), lt(products.stockQuantity, threshold))
    )
    .orderBy(products.stockQuantity);
}

// ─── Best Selling Products ───
export async function getBestSellingProducts(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      product: products,
      totalSold: sql<number>`SUM(${orderItems.quantity})`,
      totalRevenue: sql<number>`SUM(${orderItems.totalPrice})`,
    })
    .from(products)
    .innerJoin(orderItems, eq(products.id, orderItems.productId))
    .groupBy(products.id)
    .orderBy(desc(sql`SUM(${orderItems.quantity})`))
    .limit(limit);
}

// ─── Sales by Category ───
export async function getSalesByCategory() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      category: categories,
      totalSales: sql<number>`SUM(${orderItems.totalPrice})`,
      totalOrders: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
    })
    .from(categories)
    .leftJoin(products, eq(categories.id, products.categoryId))
    .leftJoin(orderItems, eq(products.id, orderItems.productId))
    .groupBy(categories.id);
}

// ─── Product Reviews ───
type CreateReviewRecordInput = {
  productId: number;
  orderId?: number | null;
  customerName: string;
  customerEmail?: string | null;
  rating: number;
  title?: string | null;
  body: string;
  images?: string[] | null;
  status?: ReviewStatus;
  isVerifiedPurchase?: boolean;
};

type ReviewDbRow = {
  id: number;
  productId: number;
  orderId: number | null;
  customerName: string;
  customerEmail: string | null;
  rating: number;
  title: string | null;
  body: string;
  images: string | null;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function parseReviewImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      entry => typeof entry === "string" && entry.trim().length > 0
    );
  } catch {
    return [];
  }
}

function toReviewIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function mapReviewRow(row: ReviewDbRow): ProductReviewItem {
  return {
    id: Number(row.id),
    productId: Number(row.productId),
    orderId: row.orderId == null ? null : Number(row.orderId),
    customerName: row.customerName || "Client",
    customerEmail: row.customerEmail ?? null,
    rating: Number(row.rating || 0),
    title: row.title ?? null,
    body: row.body || "",
    images: parseReviewImages(row.images),
    status: row.status || "pending",
    isVerifiedPurchase: Boolean(row.isVerifiedPurchase),
    createdAt: toReviewIso(row.createdAt) || new Date().toISOString(),
    updatedAt: toReviewIso(row.updatedAt) || new Date().toISOString(),
  };
}

function mapReviewToLegacy(item: ProductReviewItem) {
  return {
    id: item.id,
    productId: item.productId,
    orderId: item.orderId,
    customerName: item.customerName,
    customerEmail: item.customerEmail,
    rating: item.rating,
    title: item.title || "Avis client",
    comment: item.body || null,
    body: item.body,
    images: item.images,
    status: item.status,
    isVerifiedPurchase: item.isVerifiedPurchase,
    isApproved: item.status === "approved",
    helpfulCount: 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function getReviewByIdRaw(
  reviewId: number
): Promise<ProductReviewItem | null> {
  const db = await getDb();
  if (!db) {
    const row = demoProductReviews.find(entry => entry.id === reviewId);
    return row
      ? mapReviewRow({
          ...row,
          images: JSON.stringify(row.images || []),
        } as ReviewDbRow)
      : null;
  }

  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  if (!rows[0]) return null;
  return mapReviewRow(rows[0] as unknown as ReviewDbRow);
}

export async function createReviewRecord(
  input: CreateReviewRecordInput
): Promise<ProductReviewItem> {
  const db = await getDb();
  const now = new Date();
  const payload = {
    productId: Number(input.productId),
    orderId: input.orderId == null ? null : Number(input.orderId),
    customerName: (input.customerName || "Client").trim(),
    customerEmail: input.customerEmail?.trim() || null,
    rating: Math.max(1, Math.min(5, Number(input.rating || 0))),
    title: input.title?.trim() || null,
    body: (input.body || "").trim(),
    images: JSON.stringify(input.images || []),
    status: input.status || "pending",
    isVerifiedPurchase:
      input.isVerifiedPurchase !== undefined
        ? Boolean(input.isVerifiedPurchase)
        : input.orderId != null,
  };

  if (!db) {
    const created = {
      id: demoReviewIdSeq++,
      ...payload,
      createdAt: now,
      updatedAt: now,
      images: input.images || [],
    };
    demoProductReviews.push(created);
    return mapReviewRow({
      ...created,
      images: JSON.stringify(created.images),
    } as ReviewDbRow);
  }

  const result = await db.insert(reviews).values(payload as any);
  const insertId = Number((result as any)?.[0]?.insertId || 0);
  if (!insertId) {
    throw new Error("Failed to create review");
  }
  const created = await getReviewByIdRaw(insertId);
  if (!created) {
    throw new Error("Failed to load created review");
  }
  return created;
}

export async function createProductReview(review: any) {
  const created = await createReviewRecord({
    productId: Number(review.productId),
    orderId: review.orderId ?? null,
    customerName: review.customerName || "Client",
    customerEmail: review.customerEmail ?? null,
    rating: Number(review.rating) || 5,
    title: review.title || null,
    body: review.body ?? review.comment ?? "",
    images: Array.isArray(review.images) ? review.images : [],
    status:
      review.status ??
      (review.isApproved === true
        ? "approved"
        : review.isApproved === false
          ? "pending"
          : "pending"),
    isVerifiedPurchase:
      review.isVerifiedPurchase !== undefined
        ? Boolean(review.isVerifiedPurchase)
        : review.orderId != null,
  });
  return mapReviewToLegacy(created);
}

export async function getProductReviews(
  productId: number,
  limit = 10,
  offset = 0
) {
  const db = await getDb();
  if (!db) {
    const rows = demoProductReviews
      .filter(
        review => review.productId === productId && review.status === "approved"
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )
      .slice(offset, offset + limit);
    return rows.map(entry =>
      mapReviewToLegacy(
        mapReviewRow({
          ...entry,
          images: JSON.stringify(entry.images || []),
        } as ReviewDbRow)
      )
    );
  }
  const rows = await db
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.productId, productId), eq(reviews.status, "approved"))
    )
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);
  return rows.map(row =>
    mapReviewToLegacy(mapReviewRow(row as unknown as ReviewDbRow))
  );
}

export async function getProductAverageRating(productId: number) {
  const summary = await getProductReviewSummary(productId);
  return summary.avgRating;
}

export async function getProductReviewSummary(
  productId: number
): Promise<ProductReviewSummary> {
  const db = await getDb();
  if (!db) {
    const items = demoProductReviews.filter(
      entry => entry.productId === productId && entry.status === "approved"
    );
    const reviewsCount = items.length;
    const total = items.reduce((acc, entry) => acc + entry.rating, 0);
    const breakdownMap = new Map<number, number>();
    for (let star = 1; star <= 5; star += 1) breakdownMap.set(star, 0);
    for (const entry of items) {
      const rating = Math.max(1, Math.min(5, Number(entry.rating || 0)));
      breakdownMap.set(rating, (breakdownMap.get(rating) || 0) + 1);
    }
    return {
      avgRating:
        reviewsCount > 0 ? Math.round((total / reviewsCount) * 10) / 10 : 0,
      reviewsCount,
      breakdown: [5, 4, 3, 2, 1].map(star => ({
        star,
        count: breakdownMap.get(star) || 0,
      })),
    };
  }

  const where = and(
    eq(reviews.productId, productId),
    eq(reviews.status, "approved")
  );
  const [aggRows, breakdownRows] = await Promise.all([
    db
      .select({
        avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        reviewsCount: count(),
      })
      .from(reviews)
      .where(where),
    db
      .select({
        rating: reviews.rating,
        count: count(),
      })
      .from(reviews)
      .where(where)
      .groupBy(reviews.rating),
  ]);

  const breakdownMap = new Map<number, number>();
  for (let star = 1; star <= 5; star += 1) breakdownMap.set(star, 0);
  for (const row of breakdownRows) {
    const star = Math.max(1, Math.min(5, Number(row.rating || 0)));
    breakdownMap.set(star, Number(row.count || 0));
  }

  return {
    avgRating: Math.round(Number(aggRows[0]?.avgRating || 0) * 10) / 10,
    reviewsCount: Number(aggRows[0]?.reviewsCount || 0),
    breakdown: [5, 4, 3, 2, 1].map(star => ({
      star,
      count: breakdownMap.get(star) || 0,
    })),
  };
}

export async function listApprovedProductReviewsByCursor(input: {
  productId: number;
  limit?: number;
  cursor?: number | null;
}): Promise<{ reviews: ProductReviewItem[]; nextCursor: number | null }> {
  const limit = Math.min(50, Math.max(1, Math.floor(input.limit || 10)));
  const cursor = input.cursor || null;
  const db = await getDb();

  if (!db) {
    let rows = demoProductReviews.filter(
      entry =>
        entry.productId === input.productId && entry.status === "approved"
    );
    rows.sort((left, right) => right.id - left.id);
    if (cursor) rows = rows.filter(entry => entry.id < cursor);
    const sliced = rows.slice(0, limit + 1);
    const hasMore = sliced.length > limit;
    const items = sliced.slice(0, limit).map(entry =>
      mapReviewRow({
        ...entry,
        images: JSON.stringify(entry.images || []),
      } as ReviewDbRow)
    );
    return {
      reviews: items,
      nextCursor:
        hasMore && items.length > 0 ? items[items.length - 1].id : null,
    };
  }

  const conditions = [
    eq(reviews.productId, input.productId),
    eq(reviews.status, "approved"),
  ];
  if (cursor) conditions.push(lt(reviews.id, cursor));
  const where = and(...conditions);
  const rows = await db
    .select()
    .from(reviews)
    .where(where)
    .orderBy(desc(reviews.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows
    .slice(0, limit)
    .map(row => mapReviewRow(row as unknown as ReviewDbRow));

  return {
    reviews: items,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
  };
}

export async function listAdminReviewsByCursor(
  input: AdminReviewsQuery
): Promise<{ reviews: ProductReviewItem[]; nextCursor: number | null }> {
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit || 25)));
  const cursor = input.cursor || null;
  const status = input.status || null;
  const productId = input.productId || null;
  const q = input.q?.trim().toLowerCase() || "";
  const db = await getDb();

  if (!db) {
    let rows = [...demoProductReviews];
    if (status) rows = rows.filter(entry => entry.status === status);
    if (productId) rows = rows.filter(entry => entry.productId === productId);
    if (q) {
      rows = rows.filter(entry =>
        [
          entry.customerName,
          entry.customerEmail || "",
          entry.title || "",
          entry.body,
          String(entry.productId),
        ].some(value => value.toLowerCase().includes(q))
      );
    }
    rows.sort((left, right) => right.id - left.id);
    if (cursor) rows = rows.filter(entry => entry.id < cursor);
    const sliced = rows.slice(0, limit + 1);
    const hasMore = sliced.length > limit;
    const items = sliced.slice(0, limit).map(entry =>
      mapReviewRow({
        ...entry,
        images: JSON.stringify(entry.images || []),
      } as ReviewDbRow)
    );
    return {
      reviews: items,
      nextCursor:
        hasMore && items.length > 0 ? items[items.length - 1].id : null,
    };
  }

  const conditions = [];
  if (status) conditions.push(eq(reviews.status, status));
  if (productId) conditions.push(eq(reviews.productId, productId));
  if (cursor) conditions.push(lt(reviews.id, cursor));
  if (q) {
    conditions.push(
      or(
        like(reviews.customerName, `%${q}%`),
        like(reviews.customerEmail, `%${q}%`),
        like(reviews.title, `%${q}%`),
        like(reviews.body, `%${q}%`)
      )
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(reviews)
    .where(where)
    .orderBy(desc(reviews.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows
    .slice(0, limit)
    .map(row => mapReviewRow(row as unknown as ReviewDbRow));

  return {
    reviews: items,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
  };
}

export async function updateReviewById(
  reviewId: number,
  input: AdminReviewUpdateInput
): Promise<ProductReviewItem | null> {
  const db = await getDb();
  if (!db) {
    const index = demoProductReviews.findIndex(entry => entry.id === reviewId);
    if (index < 0) return null;
    const current = demoProductReviews[index];
    demoProductReviews[index] = {
      ...current,
      status: input.status ?? current.status,
      title: input.title !== undefined ? input.title || null : current.title,
      body: input.body !== undefined ? input.body : current.body,
      updatedAt: new Date(),
    };
    return mapReviewRow({
      ...demoProductReviews[index],
      images: JSON.stringify(demoProductReviews[index].images || []),
    } as ReviewDbRow);
  }

  const payload: Record<string, unknown> = {};
  if (input.status !== undefined) payload.status = input.status;
  if (input.title !== undefined) payload.title = input.title || null;
  if (input.body !== undefined) payload.body = input.body;
  if (Object.keys(payload).length > 0) {
    await db
      .update(reviews)
      .set(payload as any)
      .where(eq(reviews.id, reviewId));
  }
  return getReviewByIdRaw(reviewId);
}

export async function deleteReviewById(reviewId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const index = demoProductReviews.findIndex(entry => entry.id === reviewId);
    if (index < 0) return false;
    demoProductReviews.splice(index, 1);
    for (let idx = demoReviewReplies.length - 1; idx >= 0; idx -= 1) {
      if (demoReviewReplies[idx].reviewId === reviewId) {
        demoReviewReplies.splice(idx, 1);
      }
    }
    return true;
  }

  await db.delete(reviewReplies).where(eq(reviewReplies.reviewId, reviewId));
  await db.delete(reviews).where(eq(reviews.id, reviewId));
  return true;
}

export async function createReviewReply(input: {
  reviewId: number;
  adminUserId?: number | null;
  body: string;
}) {
  const db = await getDb();
  const payload = {
    reviewId: Number(input.reviewId),
    adminUserId: input.adminUserId == null ? null : Number(input.adminUserId),
    body: input.body.trim(),
  };

  if (!db) {
    const row = {
      id: demoReviewReplyIdSeq++,
      reviewId: payload.reviewId,
      adminUserId: payload.adminUserId,
      body: payload.body,
      createdAt: new Date(),
    };
    demoReviewReplies.push(row);
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
    };
  }

  const result = await db.insert(reviewReplies).values(payload as any);
  const insertId = Number((result as any)?.[0]?.insertId || 0);
  if (!insertId) {
    throw new Error("Failed to create review reply");
  }
  const rows = await db
    .select()
    .from(reviewReplies)
    .where(eq(reviewReplies.id, insertId))
    .limit(1);
  if (!rows[0]) {
    throw new Error("Failed to load review reply");
  }
  return {
    id: Number(rows[0].id),
    reviewId: Number(rows[0].reviewId),
    adminUserId:
      rows[0].adminUserId == null ? null : Number(rows[0].adminUserId),
    body: rows[0].body,
    createdAt: toReviewIso(rows[0].createdAt) || new Date().toISOString(),
  };
}

export async function listReviewReplies(reviewId: number) {
  const db = await getDb();
  if (!db) {
    return demoReviewReplies
      .filter(entry => entry.reviewId === reviewId)
      .sort((left, right) => left.id - right.id)
      .map(entry => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      }));
  }
  const rows = await db
    .select()
    .from(reviewReplies)
    .where(eq(reviewReplies.reviewId, reviewId))
    .orderBy(asc(reviewReplies.createdAt));
  return rows.map(row => ({
    id: Number(row.id),
    reviewId: Number(row.reviewId),
    adminUserId: row.adminUserId == null ? null : Number(row.adminUserId),
    body: row.body,
    createdAt: toReviewIso(row.createdAt) || new Date().toISOString(),
  }));
}

export async function getPendingReviews(limit = 50) {
  const result = await listAdminReviewsByCursor({
    status: "pending",
    limit,
  });
  return result.reviews.map(mapReviewToLegacy);
}

export async function getAllReviews(
  opts: {
    status?: "all" | "approved" | "pending" | "rejected";
    limit?: number;
    offset?: number;
  } = {}
) {
  const status = opts.status && opts.status !== "all" ? opts.status : undefined;
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const db = await getDb();
  if (!db) {
    let rows = [...demoProductReviews];
    if (status) rows = rows.filter(review => review.status === status);
    rows.sort((left, right) => right.id - left.id);
    return {
      reviews: rows.slice(offset, offset + limit).map(entry =>
        mapReviewToLegacy(
          mapReviewRow({
            ...entry,
            images: JSON.stringify(entry.images || []),
          } as ReviewDbRow)
        )
      ),
      total: rows.length,
    };
  }

  const where = status ? eq(reviews.status, status) : undefined;
  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(reviews)
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(reviews).where(where),
  ]);

  return {
    reviews: rows.map(row =>
      mapReviewToLegacy(mapReviewRow(row as unknown as ReviewDbRow))
    ),
    total: Number(countResult[0]?.count || 0),
  };
}

export async function approveReview(id: number, approved = true) {
  const updated = await updateReviewById(id, {
    status: approved ? "approved" : "pending",
  });
  if (!updated) throw new Error("Review not found");
  return mapReviewToLegacy(updated);
}

export async function deleteReview(id: number) {
  return deleteReviewById(id);
}

// ─── Wishlist ───
export async function addToWishlist(customerEmail: string, productId: number) {
  const db = await getDb();
  if (!db) return null;
  const { wishlists } = await import("../drizzle/schema");
  const existing = await db
    .select()
    .from(wishlists)
    .where(
      and(
        eq(wishlists.customerEmail, customerEmail),
        eq(wishlists.productId, productId)
      )
    )
    .limit(1);
  if (existing.length > 0) return existing[0];
  return db.insert(wishlists).values({ customerEmail, productId });
}

export async function removeFromWishlist(
  customerEmail: string,
  productId: number
) {
  const db = await getDb();
  if (!db) return;
  const { wishlists } = await import("../drizzle/schema");
  await db
    .delete(wishlists)
    .where(
      and(
        eq(wishlists.customerEmail, customerEmail),
        eq(wishlists.productId, productId)
      )
    );
}

export async function getWishlist(customerEmail: string) {
  const db = await getDb();
  if (!db) return [];
  const { wishlists } = await import("../drizzle/schema");
  const wishlistItems = await db
    .select()
    .from(wishlists)
    .where(eq(wishlists.customerEmail, customerEmail));
  const productIds = wishlistItems.map(w => w.productId);
  if (productIds.length === 0) return [];
  return db
    .select()
    .from(products)
    .where(sql`${products.id} IN (${sql.raw(productIds.join(","))})`);
}

// ─── Coupons ───
export async function validateCoupon(code: string, orderAmount: number) {
  const db = await getDb();
  if (!db) {
    const coupon = demoCoupons.find(
      entry => entry.code.toUpperCase() === code.toUpperCase() && entry.isActive
    );
    if (!coupon) return null;
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) return null;
    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount)
      return null;
    if (coupon.startDate && new Date() < coupon.startDate) return null;
    if (coupon.endDate && new Date() > coupon.endDate) return null;
    return coupon;
  }
  const { coupons } = await import("../drizzle/schema");
  const coupon = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.code, code.toUpperCase()), eq(coupons.active, true)))
    .limit(1);
  if (!coupon[0]) return null;
  const c: any = coupon[0];
  if (c.maxUses && c.currentUses >= c.maxUses) return null;
  if (c.minOrderAmount && orderAmount < c.minOrderAmount) return null;
  if (c.startDate && new Date() < c.startDate) return null;
  if (c.endDate && new Date() > c.endDate) return null;
  return c;
}

export async function applyCoupon(couponId: number) {
  const db = await getDb();
  if (!db) {
    const coupon = demoCoupons.find(entry => entry.id === couponId);
    if (!coupon) return;
    coupon.currentUses += 1;
    coupon.updatedAt = new Date();
    return;
  }
  // Legacy helper kept for compatibility. Usage is now tracked via coupon_redemptions.
  void db;
}

export async function getCoupons(limit = 50) {
  const db = await getDb();
  if (!db) {
    return [...demoCoupons]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )
      .slice(0, limit);
  }
  const { coupons } = await import("../drizzle/schema");
  return db
    .select()
    .from(coupons)
    .orderBy(desc(coupons.createdAt))
    .limit(limit);
}

export async function createCoupon(data: {
  code: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
  maxUses?: number | null;
  isActive?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  const db = await getDb();
  if (!db) {
    const now = new Date();
    const row = {
      id: demoCouponIdSeq++,
      code: data.code.toUpperCase(),
      description: data.description ?? null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minOrderAmount: data.minOrderAmount ?? 0,
      maxUses: data.maxUses ?? null,
      currentUses: 0,
      isActive: data.isActive ?? true,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      createdAt: now,
      updatedAt: now,
    };
    demoCoupons.unshift(row);
    return row;
  }

  const { coupons } = await import("../drizzle/schema");
  const insertId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await db.insert(coupons).values({
    id: insertId,
    code: data.code.toUpperCase(),
    type: data.discountType === "percentage" ? "PERCENT" : "FIXED",
    value: data.discountValue,
    minSubtotal: data.minOrderAmount ?? 0,
    usageLimit: data.maxUses ?? null,
    perSessionLimit: null,
    active: data.isActive ?? true,
    startAt: data.startDate ?? null,
    endAt: data.endDate ?? null,
    appliesTo: "ALL",
    categoryId: null,
    productId: null,
  } as any);
  const rows = await db
    .select()
    .from(coupons)
    .where(eq(coupons.id, insertId))
    .limit(1);
  return rows[0];
}

export async function updateCoupon(
  id: number,
  data: Partial<{
    code: string;
    description: string | null;
    discountType: "percentage" | "fixed";
    discountValue: number;
    minOrderAmount: number;
    maxUses: number | null;
    isActive: boolean;
    startDate: Date | null;
    endDate: Date | null;
  }>
) {
  const db = await getDb();
  if (!db) {
    const coupon = demoCoupons.find(item => item.id === id);
    if (!coupon) throw new Error("Coupon not found");
    Object.assign(coupon, {
      ...data,
      ...(data.code ? { code: data.code.toUpperCase() } : {}),
      updatedAt: new Date(),
    });
    return coupon;
  }

  const { coupons } = await import("../drizzle/schema");
  const payload: Record<string, unknown> = { ...data };
  if (typeof payload.code === "string") {
    payload.code = (payload.code as string).toUpperCase();
  }
  await db
    .update(coupons)
    .set(payload as any)
    .where(eq(coupons.id, String(id)));
  const rows = await db
    .select()
    .from(coupons)
    .where(eq(coupons.id, String(id)))
    .limit(1);
  if (!rows[0]) throw new Error("Coupon not found");
  return rows[0];
}

export async function deleteCoupon(id: number) {
  const db = await getDb();
  if (!db) {
    const index = demoCoupons.findIndex(item => item.id === id);
    if (index < 0) return false;
    demoCoupons.splice(index, 1);
    return true;
  }

  const { coupons } = await import("../drizzle/schema");
  await db.delete(coupons).where(eq(coupons.id, String(id)));
  return true;
}

export async function toggleCouponStatus(id: number, isActive?: boolean) {
  const db = await getDb();
  if (!db) {
    const coupon = demoCoupons.find(item => item.id === id);
    if (!coupon) throw new Error("Coupon not found");
    coupon.isActive =
      typeof isActive === "boolean" ? isActive : !coupon.isActive;
    coupon.updatedAt = new Date();
    return coupon;
  }

  const { coupons } = await import("../drizzle/schema");
  const existing = await db
    .select()
    .from(coupons)
    .where(eq(coupons.id, String(id)))
    .limit(1);
  if (!existing[0]) throw new Error("Coupon not found");
  const nextValue =
    typeof isActive === "boolean" ? isActive : !existing[0].active;
  await db
    .update(coupons)
    .set({ active: nextValue } as any)
    .where(eq(coupons.id, String(id)));
  const rows = await db
    .select()
    .from(coupons)
    .where(eq(coupons.id, String(id)))
    .limit(1);
  return rows[0];
}

// ─── Flash Sales ───
export async function getActiveFlashSales() {
  const db = await getDb();
  if (!db) return [];
  const { flashSales } = await import("../drizzle/schema");
  const now = new Date();
  return db
    .select()
    .from(flashSales)
    .where(
      and(
        eq(flashSales.isActive, true),
        lte(flashSales.startTime, now),
        gte(flashSales.endTime, now)
      )
    );
}

export async function getFlashSaleForProduct(productId: number) {
  const db = await getDb();
  if (!db) return null;
  const { flashSales } = await import("../drizzle/schema");
  const now = new Date();
  const result = await db
    .select()
    .from(flashSales)
    .where(
      and(
        eq(flashSales.productId, productId),
        eq(flashSales.isActive, true),
        lte(flashSales.startTime, now),
        gte(flashSales.endTime, now)
      )
    )
    .limit(1);
  return result[0];
}

// ─── Referrals ───
export async function createReferral(referrerEmail: string) {
  const db = await getDb();
  if (!db) return null;
  const { referrals } = await import("../drizzle/schema");
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  return db.insert(referrals).values({ referrerEmail, referralCode: code });
}

export async function getReferralByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const { referrals } = await import("../drizzle/schema");
  const result = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referralCode, code))
    .limit(1);
  return result[0];
}

// ─── Saved Addresses ───
export async function saveCustAddress(customerEmail: string, address: any) {
  const db = await getDb();
  if (!db) return null;
  const { savedAddresses } = await import("../drizzle/schema");
  return db.insert(savedAddresses).values({ customerEmail, ...address });
}

export async function getSavedAddresses(customerEmail: string) {
  const db = await getDb();
  if (!db) return [];
  const { savedAddresses } = await import("../drizzle/schema");
  return db
    .select()
    .from(savedAddresses)
    .where(eq(savedAddresses.customerEmail, customerEmail))
    .orderBy(desc(savedAddresses.isDefault));
}

// ─── Email Subscriptions ───
export async function subscribeToEmails(
  email: string,
  subscriptionType: any = "all"
) {
  const db = await getDb();
  if (!db) return;
  const { emailSubscriptions } = await import("../drizzle/schema");
  await db
    .insert(emailSubscriptions)
    .values({
      email,
      subscriptionType: subscriptionType as any,
      isSubscribed: true,
    })
    .onDuplicateKeyUpdate({
      set: { isSubscribed: true, subscriptionType: subscriptionType as any },
    });
}

export async function unsubscribeFromEmails(email: string) {
  const db = await getDb();
  if (!db) return;
  const { emailSubscriptions } = await import("../drizzle/schema");
  await db
    .insert(emailSubscriptions)
    .values({ email, isSubscribed: false })
    .onDuplicateKeyUpdate({ set: { isSubscribed: false } });
}

export async function getNewsletterSubscriberByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const db = await getDb();
  if (!db) {
    return (
      demoNewsletterSubscribers.find(entry => entry.email === normalized) ||
      null
    );
  }

  const { newsletterSubscribers } = await import("../drizzle/schema");
  const rows = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, normalized))
    .limit(1);
  return rows[0] || null;
}

/**
 * RGPD double opt-in flow:
 *   - first submission          → row created with status=PENDING + confirmationToken (24h TTL)
 *   - resubmission while PENDING → fresh token issued, no second row
 *   - already-SUBSCRIBED         → { already: true }, no token
 *   - previously UNSUBSCRIBED    → back to PENDING, requires re-confirmation
 *
 * Caller is responsible for actually emailing the confirmation link — this
 * function returns the token so the route layer can build + send it.
 */
export async function subscribeNewsletter(input: {
  email: string;
  source?: string | null;
  locale?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const source = input.source ? String(input.source).trim().slice(0, 64) : null;
  const locale = input.locale ? String(input.locale).trim().slice(0, 16) : null;
  const ip = input.ip ? String(input.ip).trim().slice(0, 64) : null;
  const userAgent = input.userAgent
    ? String(input.userAgent).trim().slice(0, 4096)
    : null;
  const now = new Date();
  const token = generateConfirmationToken();
  const expiresAt = new Date(now.getTime() + NEWSLETTER_CONFIRMATION_TTL_MS);

  const db = await getDb();
  if (!db) {
    const existing = demoNewsletterSubscribers.find(
      entry => entry.email === normalizedEmail
    );
    if (existing && existing.status === "SUBSCRIBED") {
      return {
        already: true,
        pending: false,
        confirmationToken: null,
        subscriber: existing,
      };
    }
    if (existing) {
      existing.status = "PENDING";
      existing.source = source;
      existing.locale = locale;
      existing.ip = ip;
      existing.userAgent = userAgent;
      existing.unsubscribedAt = null;
      existing.confirmationToken = token;
      existing.confirmationTokenExpiresAt = expiresAt;
      existing.confirmedAt = null;
      return {
        already: false,
        pending: true,
        confirmationToken: token,
        subscriber: existing,
      };
    }
    const row: NewsletterSubscriberRecord = {
      id:
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `newsletter-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      email: normalizedEmail,
      status: "PENDING",
      source,
      locale,
      ip,
      userAgent,
      createdAt: now,
      unsubscribedAt: null,
      confirmationToken: token,
      confirmationTokenExpiresAt: expiresAt,
      confirmedAt: null,
    };
    demoNewsletterSubscribers.push(row);
    return {
      already: false,
      pending: true,
      confirmationToken: token,
      subscriber: row,
    };
  }

  const { newsletterSubscribers } = await import("../drizzle/schema");
  const existingRows = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, normalizedEmail))
    .limit(1);
  const existing = existingRows[0];

  if (existing && existing.status === "SUBSCRIBED") {
    return {
      already: true,
      pending: false,
      confirmationToken: null,
      subscriber: existing,
    };
  }

  if (existing) {
    await db
      .update(newsletterSubscribers)
      .set({
        status: "PENDING",
        source,
        locale,
        ip,
        userAgent,
        unsubscribedAt: null,
        confirmationToken: token,
        confirmationTokenExpiresAt: expiresAt,
        confirmedAt: null,
      })
      .where(eq(newsletterSubscribers.id, existing.id));
    const updated = await db
      .select()
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.id, existing.id))
      .limit(1);
    return {
      already: false,
      pending: true,
      confirmationToken: token,
      subscriber: updated[0] || existing,
    };
  }

  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `newsletter-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await db.insert(newsletterSubscribers).values({
    id,
    email: normalizedEmail,
    status: "PENDING",
    source,
    locale,
    ip,
    userAgent,
    createdAt: now,
    unsubscribedAt: null,
    confirmationToken: token,
    confirmationTokenExpiresAt: expiresAt,
    confirmedAt: null,
  });
  const inserted = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id))
    .limit(1);
  return {
    already: false,
    pending: true,
    confirmationToken: token,
    subscriber: inserted[0] || null,
  };
}

/**
 * Validates an opt-in confirmation token and flips the subscriber to SUBSCRIBED.
 * Returns { ok: false, reason } for unknown / expired / already-used tokens.
 */
export async function confirmNewsletter(
  token: string
): Promise<
  { ok: true; email: string } | { ok: false; reason: "unknown" | "expired" }
> {
  const trimmed = (token || "").trim();
  if (!trimmed) return { ok: false, reason: "unknown" };
  const now = new Date();

  const db = await getDb();
  if (!db) {
    const row = demoNewsletterSubscribers.find(
      entry => entry.confirmationToken === trimmed
    );
    if (!row) return { ok: false, reason: "unknown" };
    if (
      row.confirmationTokenExpiresAt &&
      row.confirmationTokenExpiresAt.getTime() < now.getTime()
    ) {
      return { ok: false, reason: "expired" };
    }
    row.status = "SUBSCRIBED";
    row.confirmedAt = now;
    row.confirmationToken = null;
    row.confirmationTokenExpiresAt = null;
    return { ok: true, email: row.email };
  }

  const { newsletterSubscribers } = await import("../drizzle/schema");
  const rows = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmationToken, trimmed))
    .limit(1);
  const existing = rows[0];
  if (!existing) return { ok: false, reason: "unknown" };
  const expires = existing.confirmationTokenExpiresAt as Date | null;
  if (expires && expires.getTime() < now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  await db
    .update(newsletterSubscribers)
    .set({
      status: "SUBSCRIBED",
      confirmedAt: now,
      confirmationToken: null,
      confirmationTokenExpiresAt: null,
    })
    .where(eq(newsletterSubscribers.id, existing.id));
  return { ok: true, email: existing.email };
}

/**
 * RGPD-compliant unsubscribe: keeps only what's needed for the suppression
 * list (email + status) and nullifies PII + any in-flight confirmation token.
 */
export async function unsubscribeNewsletter(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();
  const db = await getDb();
  if (!db) {
    const existing = demoNewsletterSubscribers.find(
      entry => entry.email === normalizedEmail
    );
    if (!existing) return;
    existing.status = "UNSUBSCRIBED";
    existing.unsubscribedAt = now;
    existing.ip = null;
    existing.userAgent = null;
    existing.confirmationToken = null;
    existing.confirmationTokenExpiresAt = null;
    return;
  }

  const { newsletterSubscribers } = await import("../drizzle/schema");
  const existingRows = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, normalizedEmail))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) return;
  await db
    .update(newsletterSubscribers)
    .set({
      status: "UNSUBSCRIBED",
      unsubscribedAt: now,
      ip: null,
      userAgent: null,
      confirmationToken: null,
      confirmationTokenExpiresAt: null,
    })
    .where(eq(newsletterSubscribers.id, existing.id));
}

export async function listNewsletterSubscribers(input?: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const search = input?.search?.trim().toLowerCase() || "";
  const limit = Math.min(500, Math.max(1, Math.trunc(input?.limit ?? 50)));
  const offset = Math.max(0, Math.trunc(input?.offset ?? 0));
  const db = await getDb();

  if (!db) {
    const filtered = search
      ? demoNewsletterSubscribers.filter(entry =>
          entry.email.toLowerCase().includes(search)
        )
      : demoNewsletterSubscribers;
    const sorted = [...filtered].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
    );
    return {
      items: sorted.slice(offset, offset + limit),
      total: sorted.length,
      limit,
      offset,
    };
  }

  const { newsletterSubscribers } = await import("../drizzle/schema");
  const conditions = [];
  if (search) conditions.push(like(newsletterSubscribers.email, `%${search}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(newsletterSubscribers)
      .where(where)
      .orderBy(desc(newsletterSubscribers.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(newsletterSubscribers).where(where),
  ]);
  return {
    items: rows,
    total: Number(countRows[0]?.count || 0),
    limit,
    offset,
  };
}

export async function exportNewsletterSubscribers(search?: string) {
  const normalizedSearch = search?.trim().toLowerCase() || "";
  const db = await getDb();

  if (!db) {
    return [...demoNewsletterSubscribers]
      .filter(entry =>
        normalizedSearch
          ? entry.email.toLowerCase().includes(normalizedSearch)
          : true
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      );
  }

  const { newsletterSubscribers } = await import("../drizzle/schema");
  const conditions = [];
  if (normalizedSearch) {
    conditions.push(like(newsletterSubscribers.email, `%${normalizedSearch}%`));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select()
    .from(newsletterSubscribers)
    .where(where)
    .orderBy(desc(newsletterSubscribers.createdAt));
}

// ─── Chat Messages ───
export async function saveChatMessage(message: any) {
  const db = await getDb();
  if (!db) return null;
  const { chatMessages } = await import("../drizzle/schema");
  return db.insert(chatMessages).values(message);
}

export async function getChatHistory(sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  const { chatMessages } = await import("../drizzle/schema");
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
}
