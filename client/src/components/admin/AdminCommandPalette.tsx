import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  FileText,
  Grid2x2,
  Image as ImageIcon,
  LayoutGrid,
  Mail,
  Megaphone,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  Warehouse,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { type AdminModuleKey } from "@/components/admin/SidebarNav";

type CommandEntry = {
  key: AdminModuleKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: "primary" | "secondary";
};

const ALL_COMMANDS: CommandEntry[] = [
  { key: "analytics", label: "Dashboard", icon: LayoutGrid, group: "primary" },
  { key: "products", label: "Produits", icon: Boxes, group: "primary" },
  { key: "orders", label: "Commandes", icon: ShoppingCart, group: "primary" },
  { key: "customers", label: "Clients", icon: Users, group: "primary" },
  { key: "reports", label: "Analytique", icon: BarChart3, group: "primary" },
  { key: "coupons", label: "Promotions", icon: Megaphone, group: "primary" },
  { key: "settings", label: "Paramètres", icon: Settings, group: "primary" },
  { key: "categories", label: "Catégories", icon: Grid2x2, group: "secondary" },
  { key: "reviews", label: "Avis", icon: ClipboardList, group: "secondary" },
  { key: "inventory", label: "Stock", icon: Warehouse, group: "secondary" },
  { key: "banners", label: "Bannières", icon: ImageIcon, group: "secondary" },
  { key: "cms", label: "Contenu", icon: FileText, group: "secondary" },
  { key: "newsletter", label: "Newsletter", icon: Mail, group: "secondary" },
  {
    key: "activity",
    label: "Journal d'audit",
    icon: ScrollText,
    group: "secondary",
  },
];

interface AdminCommandPaletteProps {
  allowedModules?: AdminModuleKey[];
  onNavigate: (module: AdminModuleKey) => void;
}

export function AdminCommandPalette({
  allowedModules,
  onNavigate,
}: AdminCommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const allowed = allowedModules
    ? ALL_COMMANDS.filter(c => allowedModules.includes(c.key))
    : ALL_COMMANDS;

  const primary = allowed.filter(c => c.group === "primary");
  const secondary = allowed.filter(c => c.group === "secondary");

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Navigation rapide"
      description="Accédez rapidement à n'importe quelle section de l'admin"
    >
      <CommandInput placeholder="Rechercher une section..." />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        {primary.length > 0 ? (
          <CommandGroup heading="Principal">
            {primary.map(cmd => {
              const Icon = cmd.icon;
              return (
                <CommandItem
                  key={cmd.key}
                  value={cmd.label}
                  onSelect={() => {
                    onNavigate(cmd.key);
                    setOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {cmd.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
        {primary.length > 0 && secondary.length > 0 ? (
          <CommandSeparator />
        ) : null}
        {secondary.length > 0 ? (
          <CommandGroup heading="Outils">
            {secondary.map(cmd => {
              const Icon = cmd.icon;
              return (
                <CommandItem
                  key={cmd.key}
                  value={cmd.label}
                  onSelect={() => {
                    onNavigate(cmd.key);
                    setOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {cmd.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
