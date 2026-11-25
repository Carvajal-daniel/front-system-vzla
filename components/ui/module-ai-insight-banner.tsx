"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import {
  intelligenceApi,
  openContextualCopilot,
  type IntelligenceModule,
  type ModuleAnalysisResponse,
} from "@/lib/intelligence-api";

const MODULE_META: Record<
  IntelligenceModule,
  { title: string; subtitle: string }
> = {
  AGENDA: {
    title: "Raio-X IA da Agenda",
    subtitle: "Detecte horários ociosos nas próximas 48h e oportunidades de encaixe",
  },
  FINANCE: {
    title: "Raio-X IA Financeiro",
    subtitle: "Compare faturamento, ticket médio e fluxo semanal em segundos",
  },
  CLIENTS: {
    title: "Raio-X IA de Clientes",
    subtitle: "Identifique clientes inativos, retenção e alertas de satisfação",
  },
  SERVICES: {
    title: "Raio-X IA de Serviços",
    subtitle: "Descubra combos frequentes e oportunidades de aumento de ticket",
  },
  INVENTORY: {
    title: "Raio-X IA de Estoque",
    subtitle: "Monitore ruptura iminente e produtos parados há +60 dias",
  },
  TEAM: {
    title: "Raio-X IA da Equipe",
    subtitle: "Avalie taxa de retorno, avaliações e ocupação por profissional",
  },
};

export function ModuleAiInsightBanner({
  module,
  className = "",
}: {
  module: IntelligenceModule;
  className?: string;
}) {
  const meta = MODULE_META[module];
  const [analysis, setAnalysis] = useState<ModuleAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleAnalyze() {
    if (loading) return;
    setLoading(true);
    setExpanded(true);
    try {
      const result = await intelligenceApi.analyzeModule(module);
      setAnalysis(result);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Não foi possível gerar o Raio-X IA deste módulo agora.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-label={meta.title}
      className={`rounded-xl border border-accent/25 bg-surface/95 shadow-xs transition-colors ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink truncate">
              {meta.title}
            </p>
            <p className="text-xs text-ink-muted truncate">{meta.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleAnalyze()}
            disabled={loading}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-60 shadow-xs"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : analysis ? (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            ) : (
              <Sparkles className="size-3.5" aria-hidden="true" />
            )}
            <span>
              {loading
                ? "Analisando..."
                : analysis
                  ? "Atualizar Raio-X IA"
                  : "Gerar Raio-X IA do Módulo"}
            </span>
          </button>

          {analysis && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              aria-label={expanded ? "Recolher análise" : "Expandir análise"}
              className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border-subtle bg-canvas/50 text-ink-secondary hover:border-border-strong hover:text-ink transition-colors"
            >
              {expanded ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>

      {expanded && (loading || analysis) && (
        <div className="border-t border-border-subtle px-3.5 py-3 space-y-3">
          {loading && !analysis ? (
            <div className="flex items-center gap-2 py-2 text-xs text-ink-muted">
              <Loader2 className="size-4 animate-spin text-accent" aria-hidden="true" />
              <span>Consultando métricas reais do módulo com a IA...</span>
            </div>
          ) : analysis ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink leading-snug">
                  {analysis.headline}
                </p>
                <span className="rounded-full border border-accent/25 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                  {analysis.provider === "GEMINI" ? "Gemini Flash-Lite" : "Análise Local"}
                </span>
              </div>

              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {analysis.insights.map((item, idx) => {
                  const Icon =
                    item.severity === "WARNING"
                      ? AlertTriangle
                      : item.severity === "OPPORTUNITY"
                        ? TrendingUp
                        : Info;
                  const iconColor =
                    item.severity === "WARNING"
                      ? "text-[var(--status-warning)]"
                      : item.severity === "OPPORTUNITY"
                        ? "text-[var(--status-success)]"
                        : "text-accent";

                  return (
                    <div
                      key={`${item.title}-${idx}`}
                      className="rounded-lg border border-border-subtle bg-canvas/50 p-2.5 space-y-1"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                        <Icon className={`size-3.5 shrink-0 ${iconColor}`} aria-hidden="true" />
                        <span className="truncate">{item.title}</span>
                      </div>
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        {item.detail}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/20 bg-accent-soft/45 px-3 py-2">
                <p className="text-xs text-ink">
                  <span className="font-semibold text-accent">Próxima ação: </span>
                  {analysis.recommendedAction}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    openContextualCopilot({
                      module,
                      prompt: `Com base no Raio-X de ${module} ("${analysis.headline}"), como posso executar: ${analysis.recommendedAction}`,
                    })
                  }
                  className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-accent/35 bg-surface px-2.5 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-ink transition-colors"
                >
                  <Bot className="size-3.5" aria-hidden="true" />
                  <span>Aprofundar no Copiloto IA</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
