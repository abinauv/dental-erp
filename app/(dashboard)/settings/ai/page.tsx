"use client"

import { useState, useEffect } from "react"
import { AIUsageStats } from "@/components/ai/ai-usage-stats"

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
  ai_model_preference: "balanced" | "quality" | "economy"
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
  ai_model_preference: "balanced",
  ai_financial_approval_limit: 5000,
  ai_monthly_budget: 10000,
}

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<"unknown" | "configured" | "missing">("unknown")

  useEffect(() => {
    // Load settings
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        // Merge AI settings from the key-value store
        const merged = { ...DEFAULTS }
        if (data.settings) {
          for (const s of data.settings) {
            if (s.key in merged) {
              const val = s.value
              if (typeof (merged as any)[s.key] === "boolean") (merged as any)[s.key] = val === "true"
              else if (typeof (merged as any)[s.key] === "number") (merged as any)[s.key] = Number(val)
              else (merged as any)[s.key] = val
            }
          }
        }
        setSettings(merged)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Quick check: try hitting /api/ai/chat with an empty body — if 500 with key error, key is missing
    // For now, just show "configured" if OPENROUTER_API_KEY env var is referenced
    setApiKeyStatus("unknown")
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
        category: "ai",
      }))
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
        <h1 className="text-xl font-bold">AI Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure AI features powered by OpenRouter</p>
      </div>

      {/* API Key status */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">OpenRouter API Key</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set OPENROUTER_API_KEY in your .env file. Restart the app after changes.
            </p>
          </div>
          <span className="text-xs rounded-full px-2.5 py-1 bg-blue-100 text-blue-800">
            Check .env
          </span>
        </div>
      </div>

      {/* Master toggle */}
      <section>
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
          <div>
            <p className="text-sm font-semibold">AI Features Master Switch</p>
            <p className="text-xs text-muted-foreground">Enable or disable all AI features at once</p>
          </div>
          <ToggleSwitch checked={settings.ai_enabled} onChange={() => toggle("ai_enabled")} />
        </div>
      </section>

      {/* Feature toggles */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Features</h2>
        {[
          { key: "ai_chat_enabled" as const, label: "AI Chat Widget", desc: "Floating chat assistant on all pages" },
          { key: "ai_command_bar_enabled" as const, label: "Command Bar (Ctrl+K)", desc: "Natural-language command execution" },
          { key: "ai_auto_reminders" as const, label: "Auto Appointment Reminders", desc: "AI-triggered reminders before appointments" },
          { key: "ai_morning_briefing" as const, label: "Morning Briefing", desc: "Daily clinic summary sent to admins" },
          { key: "ai_risk_scoring_enabled" as const, label: "Patient Risk Scoring", desc: "Automatic risk calculation on intake" },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ToggleSwitch checked={settings[key]} onChange={() => toggle(key)} />
          </div>
        ))}
      </section>

      {/* Model preference */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Model Preference</h2>
        <div className="flex gap-3">
          {(["economy", "balanced", "quality"] as const).map((pref) => (
            <button
              key={pref}
              onClick={() => { setSettings((p) => ({ ...p, ai_model_preference: pref })); setSaved(false) }}
              className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                settings.ai_model_preference === pref ? "border-primary bg-primary/10" : "hover:bg-muted"
              }`}
            >
              <p className="text-sm font-semibold capitalize">{pref}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pref === "economy" ? "Fastest, lowest cost" : pref === "balanced" ? "Best speed/quality mix" : "Highest accuracy"}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Limits */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Limits & Guardrails</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">Financial Approval Limit (₹)</label>
            <input
              type="number"
              value={settings.ai_financial_approval_limit}
              onChange={(e) => { setSettings((p) => ({ ...p, ai_financial_approval_limit: Number(e.target.value) })); setSaved(false) }}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Transactions above this amount need manual approval</p>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">Monthly AI Budget (₹)</label>
            <input
              type="number"
              value={settings.ai_monthly_budget}
              onChange={(e) => { setSettings((p) => ({ ...p, ai_monthly_budget: Number(e.target.value) })); setSaved(false) }}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Estimated OpenRouter cost cap per month</p>
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
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {saved && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
      </div>
    </div>
  )
}

// Simple toggle switch component
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`}
      />
    </button>
  )
}
