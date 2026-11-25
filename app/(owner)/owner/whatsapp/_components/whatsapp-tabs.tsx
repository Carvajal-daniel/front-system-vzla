"use client";

import Link from "next/link";
import { BarChart3, MessageSquare } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

export function WhatsAppTabs({
  active,
}: {
  active: "inbox" | "intelligence";
}) {
  const { locale } = useLocale();
  const es = locale === "es";

  const tabs = [
    {
      id: "inbox" as const,
      href: "/owner/whatsapp",
      label: es ? "Inbox & Atención" : "Inbox & Atendimento",
      icon: MessageSquare,
    },
    {
      id: "intelligence" as const,
      href: "/owner/whatsapp/intelligence",
      label: "WhatsApp Intelligence",
      icon: BarChart3,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="WhatsApp"
      className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border-subtle bg-surface p-1 shadow-xs"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              isActive
                ? "bg-accent text-accent-ink shadow-xs"
                : "text-ink-secondary hover:bg-subtle hover:text-ink"
            }`}
          >
            <Icon size={14} aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
