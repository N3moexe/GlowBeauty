import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { useReducedMotion } from "framer-motion";
import { Suspense, lazy, useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { BrandThemeProvider } from "./contexts/BrandThemeContext";
import { StorefrontNavProvider } from "./contexts/StorefrontNavContext";
import AnnouncementBar from "./components/storefront/AnnouncementBar";
import AtmosphereLayer from "./components/storefront/AtmosphereLayer";
import IntegrationsLoader from "./components/storefront/IntegrationsLoader";
import { usePageTracking } from "./hooks/usePageTracking";
import ScrollProgressBar from "./components/storefront/ScrollProgressBar";

const Home = lazy(() => import("./pages/Home"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const PublicPage = lazy(() => import("./pages/PublicPage"));

const Admin = lazy(() => import("./pages/Admin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminCms = lazy(() => import("./pages/AdminCms"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminCategories = lazy(() => import("./pages/AdminCategories"));
const AdminCoupons = lazy(() => import("./pages/AdminCoupons"));
const AdminChatbot = lazy(() => import("./pages/AdminChatbot"));
const AdminStorefront = lazy(() => import("./pages/AdminStorefront"));
const AdminPages = lazy(() => import("./pages/AdminPages"));
const AdminNavigation = lazy(() => import("./pages/AdminNavigation"));
const AdminTheme = lazy(() => import("./pages/AdminTheme"));
const AdminEmailTemplates = lazy(() => import("./pages/AdminEmailTemplates"));
const AdminIntegrations = lazy(() => import("./pages/AdminIntegrations"));
const AdminOrderDetail = lazy(() => import("./pages/AdminOrderDetail"));
const AdminMedia = lazy(() => import("./pages/AdminMedia"));
const AdminCustomers = lazy(() => import("./pages/AdminCustomers"));
const Chat = lazy(() => import("./pages/Chat"));
const AIChatbot = lazy(() => import("./components/AIChatbot"));
const CommandPalette = lazy(
  () => import("./components/storefront/CommandPalette")
);

function GlobalEnhancements() {
  const [location] = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const activate = () => setReady(true);
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(activate, { timeout: 1400 });
    } else {
      timeoutId = window.setTimeout(activate, 350);
    }

    return () => {
      if (
        idleId !== undefined &&
        typeof idleWindow.cancelIdleCallback === "function"
      ) {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const isAdminSurface =
    location === "/chat" ||
    location === "/login" ||
    location === "/admin-login" ||
    location.startsWith("/admin");

  if (!ready || isAdminSurface) return null;

  return (
    <Suspense fallback={null}>
      <CommandPalette />
      <AIChatbot isOpen={false} />
    </Suspense>
  );
}

function Router() {
  usePageTracking();
  const [location] = useLocation();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  }, [location, shouldReduceMotion]);

  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <Switch location={location}>
        <Route path={"/"} component={Home} />
        {/* Shop routes - short and long versions */}
        <Route path={"/shop"} component={Shop} />
        <Route path={"/boutique"} component={Shop} />
        {/* Product detail - short and long versions */}
        <Route path={"/p/:slug"} component={ProductDetail} />
        <Route path={"/produit/:slug"} component={ProductDetail} />
        {/* Cart routes - short and long versions */}
        <Route path={"/cart"} component={Cart} />
        <Route path={"/panier"} component={Cart} />
        {/* Checkout routes - short and long versions */}
        <Route path={"/checkout"} component={Checkout} />
        <Route path={"/commande"} component={Checkout} />
        {/* Order tracking - short and long versions */}
        <Route path={"/track"} component={OrderTracking} />
        <Route path={"/suivi"} component={OrderTracking} />
        {/* Static CMS pages — legal, about, contact, etc.
                Must NOT collide with /p/:slug which is short product detail. */}
        <Route path={"/page/:slug"} component={PublicPage} />
        {/* Chat support */}
        <Route path={"/chat"} component={Chat} />
        {/* Admin routes */}
        <Route path={"/login"} component={AdminLogin} />
        <Route path={"/admin-login"} component={AdminLogin} />
        <Route path={"/admin/chatbot"} component={AdminChatbot} />
        <Route path={"/admin/cms/new"} component={AdminCms} />
        <Route path={"/admin/cms/:id"} component={AdminCms} />
        <Route path={"/admin/cms"} component={AdminCms} />
        <Route path={"/admin/categories"} component={AdminCategories} />
        <Route path={"/admin/coupons"} component={AdminCoupons} />
        <Route path={"/admin/storefront"} component={AdminStorefront} />
        <Route path={"/admin/pages/:id"} component={AdminPages} />
        <Route path={"/admin/pages"} component={AdminPages} />
        <Route path={"/admin/navigation"} component={AdminNavigation} />
        <Route path={"/admin/theme"} component={AdminTheme} />
        <Route
          path={"/admin/email-templates"}
          component={AdminEmailTemplates}
        />
        <Route path={"/admin/integrations"} component={AdminIntegrations} />
        <Route path={"/admin/media"} component={AdminMedia} />
        <Route path={"/admin/settings/:section"} component={AdminSettings} />
        <Route path={"/admin/settings"} component={AdminSettings} />
        <Route path={"/admin/orders/:id"} component={AdminOrderDetail} />
        <Route path={"/admin/customers"} component={AdminCustomers} />
        <Route path={"/admin/:module"} component={Admin} />
        <Route path={"/admin"} component={Admin} />
        {/* 404 */}
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function StorefrontOnlyHeadBits() {
  // Admin pages don't need the announcement bar or marketing pixels — only the
  // public storefront does. Path check keeps admin tidy.
  const [location] = useLocation();
  const isAdmin =
    location.startsWith("/admin") ||
    location === "/login" ||
    location === "/admin-login";
  if (isAdmin) return null;
  return (
    <>
      <AtmosphereLayer />
      <AnnouncementBar />
      <IntegrationsLoader />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <BrandThemeProvider>
          <StorefrontNavProvider>
            <CartProvider>
              <TooltipProvider>
                <ScrollProgressBar />
                <Toaster />
                <GlobalEnhancements />
                <StorefrontOnlyHeadBits />
                <Router />
              </TooltipProvider>
            </CartProvider>
          </StorefrontNavProvider>
        </BrandThemeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
