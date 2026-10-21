import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  Clock3,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Phone,
  Paperclip,
  Receipt,
  Settings,
  Sprout,
  Sun,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type IconTone = "copper" | "pine" | "gold" | "ink" | "danger" | "info";

export function IconChip({
  icon: Icon,
  tone = "copper",
  className,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  className?: string;
}) {
  return (
    <span className={cn("icon-chip", `icon-chip-${tone}`, className)}>
      <Icon className="h-4 w-4" strokeWidth={1.9} />
    </span>
  );
}

export const NAV_ICONS: Record<string, LucideIcon> = {
  "/today": Sun,
  "/dashboard": LayoutDashboard,
  "/work-tasks": ListChecks,
  "/leads": Users,
  "/calling": Phone,
  "/follow-ups": Clock3,
  "/clients": Building2,
  "/proposals": FileText,
  "/campaigns": Megaphone,
  "/nurture": Sprout,
  "/engagements": FolderKanban,
  "/resources": UsersRound,
  "/documents": Paperclip,
  "/invoices": Receipt,
  "/orders": ClipboardList,
  "/spend": Wallet,
  "/profit": TrendingUp,
  "/reports": BarChart3,
  "/people": UserRound,
  "/trash": Trash2,
  "/settings": Settings,
};
