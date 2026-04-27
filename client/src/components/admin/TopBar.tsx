import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  Moon,
  Plus,
  Search,
  Sun,
  UserCircle2,
} from "lucide-react";

export type TopBarNotification = {
  id: string;
  title: string;
  description?: string;
  count?: number;
  onSelect?: () => void;
};

type TopBarProps = {
  userName?: string | null;
  onQuickAction?: (action: "add_product" | "create_coupon") => void;
  notifications?: TopBarNotification[];
  onLogout?: () => void;
  onSearchSubmit?: (query: string) => void;
};

export default function TopBar({
  userName,
  onQuickAction,
  notifications = [],
  onLogout,
  onSearchSubmit,
}: TopBarProps) {
  const shouldReduceMotion = useReducedMotion();
  const { theme, toggleTheme } = useTheme();
  const hasQuickActions = Boolean(onQuickAction);
  const totalNotificationCount = notifications.reduce(
    (total, item) => total + Math.max(item.count ?? 1, 0),
    0
  );
  const hasNotifications = totalNotificationCount > 0;
  const badgeCountLabel = totalNotificationCount > 99 ? "99+" : String(totalNotificationCount);

  const handleThemeToggle = () => {
    if (toggleTheme) {
      toggleTheme();
      return;
    }

    const root = document.documentElement;
    root.classList.toggle("dark");
  };

  return (
    <header className="h-16 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
        className="flex h-full items-center gap-3 px-4 md:gap-4 md:px-6"
      >
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher commandes, produits, clients..."
            className="h-9 rounded-xl border-border/70 bg-white/80 pl-9 shadow-sm"
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !onSearchSubmit) return;
              const query = event.currentTarget.value.trim();
              if (!query) return;
              event.preventDefault();
              onSearchSubmit(query);
            }}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/70 bg-white/80 shadow-sm" disabled={!hasQuickActions}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Quick actions</span>
              <ChevronDown className="hidden sm:inline h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Actions rapides</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onQuickAction?.("add_product")}>Ajouter un produit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onQuickAction?.("create_coupon")}>Creer un coupon</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-xl bg-white/60 hover:bg-white/80">
              <Bell className="h-4 w-4" />
              {hasNotifications ? (
                <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-crimson text-white">
                  {badgeCountLabel}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
            ) : (
              notifications.map(item => (
                <DropdownMenuItem
                  key={item.id}
                  className="flex items-start justify-between gap-3"
                  onSelect={() => item.onSelect?.()}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium leading-tight">{item.title}</p>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground leading-tight">{item.description}</p>
                    ) : null}
                  </div>
                  {(item.count ?? 0) > 1 ? (
                    <Badge variant="outline" className="shrink-0">
                      {item.count}
                    </Badge>
                  ) : null}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="rounded-xl bg-white/60 hover:bg-white/80" onClick={handleThemeToggle} title="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 rounded-xl bg-white/60 px-2 hover:bg-white/80">
              <UserCircle2 className="h-5 w-5" />
              <span className="hidden md:inline text-sm">{userName || "Admin"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profil</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              disabled={!onLogout}
              onSelect={(event) => {
                event.preventDefault();
                onLogout?.();
              }}
            >
              Deconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </header>
  );
}
