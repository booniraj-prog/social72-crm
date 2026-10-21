"use client";

import type { ButtonHTMLAttributes } from "react";
import {
  ArrowUpDown,
  Ban,
  Check,
  CheckCheck,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  Link2,
  ListPlus,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Share2,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export const ACTION_META = {
  new: { icon: Plus, label: "New" },
  add: { icon: ListPlus, label: "Add line" },
  edit: { icon: Pencil, label: "Edit" },
  delete: { icon: Trash2, label: "Delete" },
  deactivate: { icon: Ban, label: "Deactivate" },
  preview: { icon: Eye, label: "Preview" },
  export: { icon: Download, label: "Export" },
  pdf: { icon: FileText, label: "PDF" },
  actions: { icon: MoreHorizontal, label: "Actions" },
  approve: { icon: Check, label: "Approve" },
  reject: { icon: X, label: "Reject" },
  save: { icon: Save, label: "Save" },
  cancel: { icon: X, label: "Cancel" },
  close: { icon: X, label: "Close" },
  restore: { icon: RotateCcw, label: "Restore" },
  reset: { icon: RotateCcw, label: "Reset" },
  print: { icon: Printer, label: "Print" },
  share: { icon: Share2, label: "Share" },
  copy: { icon: Copy, label: "Copy" },
  dedupe: { icon: Copy, label: "Remove duplicates" },
  apply: { icon: Filter, label: "Apply filters" },
  filter: { icon: Filter, label: "Filter" },
  search: { icon: Search, label: "Search" },
  sort: { icon: ArrowUpDown, label: "Sort" },
  complete: { icon: CheckCheck, label: "Complete" },
  call: { icon: Phone, label: "Call" },
  pick: { icon: UserPlus, label: "Pick lead" },
  tag: { icon: Tag, label: "Tag project" },
  browse: { icon: Upload, label: "Browse file" },
  email: { icon: Mail, label: "Email" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  link: { icon: Link2, label: "Copy link" },
  logout: { icon: LogOut, label: "Sign out" },
  signin: { icon: LogIn, label: "Sign in" },
} as const;

export type ActionName = keyof typeof ACTION_META;

type Props = {
  action: ActionName;
  label?: string;
  href?: string;
  target?: string;
  rel?: string;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

export function ActionIcon({ action, label, href, target, rel, className, type = "button", ...props }: Props) {
  const meta = ACTION_META[action];
  const Icon = meta.icon as LucideIcon;
  const title = label ?? meta.label;
  const classes = cn("action-icon", `action-icon-${action}`, className);
  const icon = <Icon className="h-4 w-4" strokeWidth={1.9} />;

  if (href) {
    return (
      <a href={href} className={classes} title={title} aria-label={title} data-tooltip={title} target={target} rel={rel}>
        {icon}
      </a>
    );
  }

  return (
    <button type={type} className={classes} title={title} aria-label={title} data-tooltip={title} {...props}>
      {icon}
    </button>
  );
}

export function ActionsHeader({ className = "px-3 py-2" }: { className?: string }) {
  return (
    <th className={cn(className, "text-right")}>
      <span className="inline-flex justify-end text-ink-soft" title="Actions" aria-label="Actions" data-tooltip="Actions">
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.9} />
      </span>
    </th>
  );
}
