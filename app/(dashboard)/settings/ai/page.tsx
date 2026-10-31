'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AIUsageStats } from '@/components/ai/ai-usage-stats'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

/**
 * AI Settings page — /settings/ai
 * Displays AI feature toggles backed by the Setting model (key-value store).
 * Fetches/saves via GET/PUT /api/settings.
 */

interface AISettings {
  ai_enabled: boolean
  ai_chat_enabled: boolean
  ai_command_bar_enabled: boolean
  ai_auto_reminders: boolean
  ai_morning_briefing: boolean
  ai_risk_scoring_enabled: boolean
  ai_model_preference: 'balanced' | 'quality' | 'economy'
  ai_financial_approval_limit: number
  ai_monthly_budget: number
}

const DEFAULTS: AISettings = {
  ai_enabled: true,
  ai_chat_enabled: true,
  ai_command_bar_enabled: true,
  ai_auto_reminders: true,
  ai_morning_briefing: true,
  ai_risk_scoring_enabled: true,
  ai_model_preference: 'balanced',
  ai_financial_approval_limit: 5000,
  ai_monthly_budget: 10000,
}

export default function AISettingsPage() {
  const t = useTranslations('settings.ai')
  const { currencySymbol } = useClinicFormatters()
  const [settings, setSettings] = useState<AISettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<'unknown' | 'configured' | 'missing'>('unknown')

  useEffect(() => {
    // Load settings
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        // Merge AI settings from the key-value store
        const merged = { ...DEFAULTS }
        if (data.settings) {
          for (const s of data.settings) {
            if (s.key in merged) {
              const val = s.value
              if (typeof (merged as any)[s.key] === 'boolean')
                (merged as any)[s.key] = val === 'true'
              else if (typeof (merged as any)[s.key] === 'number')
                (merged as any)[s.key] = Number(val)
              else (merged as any)[s.key] = val
            }
          }
        }
        setSettings(merged)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Ask the server whether the active AI provider's credentials are
    // configured (env vars aren't visible client-side). Falls back to
    // "unknown" if the check fails.
    fetch('/api/ai/key-status')
      .then((r) => r.json())
      .then((d) => setApiKeyStatus(d.configured ? 'configured' : 'missing'))
      .catch(() => setApiKeyStatus('unknown'))
  }, [])

  const toggle = (key: keyof AISettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      // Convert to settings array
      const settingsArr = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
        category: 'ai',
      }))
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsArr }),
      })
      setSaved(true)
    } catch {
      // show error
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* API Key status */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{t('apiKeyTitle')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('apiKeyDesc')}</p>
          </div>
          <span className="text-xs rounded-full px-2.5 py-1 bg-blue-100 text-blue-800">
            {t('checkEnv')}
          </span>
        </div>
      </div>

      {/* Master toggle */}
      <section>
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
          <div>
            <p className="text-sm font-semibold">{t('masterTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('masterDesc')}</p>
          </div>
          <ToggleSwitch
            checked={settings.ai_enabled}
            onChange={() => toggle('ai_enabled')}
            label={t('masterTitle')}
          />
        </div>
      </section>

      {/* Feature toggles */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('featuresHeading')}
        </h2>
        {[
          {
            key: 'ai_chat_enabled' as const,
            label: t('feat.chatLabel'),
            desc: t('feat.chatDesc'),
          },
          {
            key: 'ai_command_bar_enabled' as const,
            label: t('feat.commandLabel'),
            desc: t('feat.commandDesc'),
          },
          {
            key: 'ai_auto_reminders' as const,
            label: t('feat.remindersLabel'),
            desc: t('feat.remindersDesc'),
          },
          {
            key: 'ai_morning_briefing' as const,
            label: t('feat.briefingLabel'),
            desc: t('feat.briefingDesc'),
          },
          {
            key: 'ai_risk_scoring_enabled' as const,
            label: t('feat.riskLabel'),
            desc: t('feat.riskDesc'),
          },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ToggleSwitch checked={settings[key]} onChange={() => toggle(key)} label={label} />
          </div>
        ))}
      </section>

      {/* Model preference */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {t('modelPreference')}
        </h2>
        <div className="flex gap-3">
          {(['economy', 'balanced', 'quality'] as const).map((pref) => (
            <button
              key={pref}
              onClick={() => {
                setSettings((p) => ({ ...p, ai_model_preference: pref }))
                setSaved(false)
              }}
              className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                settings.ai_model_preference === pref
                  ? 'border-primary bg-primary/10'
                  : 'hover:bg-muted'
              }`}
            >
              <p className="text-sm font-semibold">{t(`model.${pref}`)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t(`model.${pref}Desc`)}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Limits */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t('limitsHeading')}
        </h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('financialLimit', { currency: currencySymbol })}
            </label>
            <input
              type="number"
              value={settings.ai_financial_approval_limit}
              onChange={(e) => {
                setSettings((p) => ({ ...p, ai_financial_approval_limit: Number(e.target.value) }))
                setSaved(false)
              }}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('financialLimitHint')}</p>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('monthlyBudget', { currency: currencySymbol })}
            </label>
            <input
              type="number"
              value={settings.ai_monthly_budget}
              onChange={(e) => {
                setSettings((p) => ({ ...p, ai_monthly_budget: Number(e.target.value) }))
                setSaved(false)
              }}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('monthlyBudgetHint')}</p>
          </div>
        </div>
      </section>

      {/* Usage Dashboard */}
      <section>
        <AIUsageStats />
      </section>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {saving ? t('saving') : t('saveSettings')}
        </button>
        {saved && <span className="text-xs text-emerald-600 font-medium">{t('savedCheck')}</span>}
      </div>
    </div>
  )
}

// Simple toggle switch component.
// `role`/`aria-checked`/`aria-label` are what make this reachable as a switch:
// without them it is an unlabelled <button>, invisible to screen readers and
// to getByRole('switch').
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
      />
    </button>
  )
}
