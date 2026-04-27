import EditorialFooter from "@/components/storefront/sections/EditorialFooter";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";

export default function Footer() {
  const { settings } = useStorefrontSettings();

  const storeName = settings.storeName || "SenBonsPlans";
  const storeContact = settings.storeContact || "+221 78 891 10 10";
  const supportEmail = settings.supportEmail || "contact@senbonsplans.com";
  const footerAddress = settings.footerAddress || "Dakar, Senegal";

  return (
    <EditorialFooter
      storeName={storeName}
      storeContact={storeContact}
      supportEmail={supportEmail}
      footerAddress={footerAddress}
      paymentMethodsText={settings.paymentMethodsText}
    />
  );
}

