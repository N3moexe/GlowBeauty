import { trpc } from "@/lib/trpc";

const defaults = {
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
  promoSubtitle: "Activez les offres exclusives et augmentez le panier moyen avec des produits tendance.",
  promoLinkLabel: "Voir les promotions",
  promoLinkHref: "/boutique",
  paymentWaveEnabled: true,
  paymentOrangeEnabled: true,
  paymentFreeMoneyEnabled: true,
  paymentCardEnabled: false,
};

export function useStorefrontSettings() {
  const query = trpc.settings.storefront.useQuery(undefined, {
    staleTime: 15 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 15 * 1000,
    retry: 1,
  });

  return {
    ...query,
    settings: query.data || defaults,
  };
}
