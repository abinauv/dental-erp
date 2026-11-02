'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface UsageStats {
  allTime: {
    conversations: number
    executions: number
    insights: number
    tokens: number
    costINR: number
  }
  thisMonth: {
    conversations: number
    executions: number
    tokens: number
    costINR: number
  }
  skillBreakdown: Array<{
    skill: string
    executions: number
    cost: number
  }>
}

/**
 * AIUsageStats — usage dashboard rendered inside the AI Settings page (Phase 7).
 * Fetches from GET /api/ai/usage (admin-only).
 */
export function AIUsageStats() {
  const t = useTranslations('ai.usageStats')
  const { formatNumber, formatCurrency } = useClinicFormatters()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ai/usage')
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /* ---- loading skeleton ---- */
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-40 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="h-16 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (!stats) return null

  /* ---- stat-card data ---- */
  const cards = [
    {
      label: t('conversations'),
      thisMonth: stats.thisMonth.conversations,
      allTime: stats.allTime.conversations,
      icon: '💬',
    },
    {
      label: t('commandsRun'),
      thisMonth: stats.thisMonth.executions,
      allTime: stats.allTime.executions,
      icon: '⚡',
    },
    {
      label: t('tokensUsed'),
      thisMonth: stats.thisMonth.tokens,
      allTime: stats.allTime.tokens,
      icon: '🔢',
      format: (n: number) => formatNumber(n),
    },
  ]

  /* ---- max bar width for skill breakdown ---- */
  const maxExecs = stats.skillBreakdown[0]?.executions || 1

  return (
    <div className="space-y-4">
      {/* section header */}
      <div>
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('subtitle')}</p>
      </div>

      {/* top-line cards */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-1.5 mb-1">
              <span>{card.icon}</span>
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-lg font-bold">
              {card.format ? card.format(card.thisMonth) : card.thisMonth}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('allTime', {
                value: card.format ? card.format(card.allTime) : card.allTime,
              })}
            </p>
          </div>
        ))}
      </div>

      {/* cost card */}
      <div className="rounded-lg border p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span>💰</span>
            <span className="text-xs font-semibold">{t('estimatedCost')}</span>
          </div>
          <span className="text-xs text-muted-foreground">{t('viaOpenRouter')}</span>
        </div>
        <div className="flex items-center gap-6 mt-2">
          <div>
            <p className="text-xs text-muted-foreground">{t('thisMonth')}</p>
            <p className="text-sm font-bold">
              {formatCurrency(stats.thisMonth.costINR, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('allTimeLabel')}</p>
            <p className="text-sm font-semibold text-muted-foreground">
              {formatCurrency(stats.allTime.costINR, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('insightsGenerated')}</p>
            <p className="text-sm font-semibold">{stats.allTime.insights}</p>
          </div>
        </div>
      </div>

      {/* skill breakdown */}
      {stats.skillBreakdown.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">{t('topSkills')}</p>
          <div className="space-y-2">
            {stats.skillBreakdown.slice(0, 6).map((s) => (
              <div key={s.skill} className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground capitalize w-36 truncate">
                  {s.skill.replace(/[._-]/g, ' ')}
                </span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(s.executions / maxExecs) * 100}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-8 text-right">
                  {t('execCount', { count: s.executions })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground italic">{t('costsNote')}</p>
    </div>
  )
}
