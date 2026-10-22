'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Calendar,
  Receipt,
  MessageSquare,
  Users,
  Shield,
  Link2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Circle,
  Sparkles,
  Cpu,
  Upload,
  CreditCard,
  Mail,
  Smartphone,
  Star,
  Video,
  BookOpen,
  ArrowLeft,
  ClipboardList,
} from 'lucide-react'

interface SetupStep {
  title: string
  description: string
  steps: string[]
  tips?: string[]
  link?: { label: string; href: string }
  externalLinks?: { label: string; url: string }[]
  videoId?: string
}

type Priority = 'essential' | 'recommended' | 'optional'

// Presentation + ordering only; the title, description, estimatedTime and
// guides for each section live in the catalogue under
// settings.setupGuide.sections.<id> and are merged in at render time.
interface SectionMeta {
  id: string
  icon: React.ElementType
  color: string
  priority: Priority
}

interface SetupSection extends SectionMeta {
  title: string
  description: string
  estimatedTime: string
  guides: SetupStep[]
}

const SECTION_META: SectionMeta[] = [
  { id: 'clinic', icon: Building2, color: 'text-blue-600 bg-blue-50', priority: 'essential' },
  { id: 'staff', icon: Users, color: 'text-indigo-600 bg-indigo-50', priority: 'essential' },
  {
    id: 'procedures',
    icon: ClipboardList,
    color: 'text-pink-600 bg-pink-50',
    priority: 'essential',
  },
  {
    id: 'appointments',
    icon: Calendar,
    color: 'text-green-600 bg-green-50',
    priority: 'essential',
  },
  { id: 'billing', icon: Receipt, color: 'text-purple-600 bg-purple-50', priority: 'essential' },
  {
    id: 'payment-gateway',
    icon: CreditCard,
    color: 'text-emerald-600 bg-emerald-50',
    priority: 'recommended',
  },
  { id: 'sms', icon: Smartphone, color: 'text-orange-600 bg-orange-50', priority: 'recommended' },
  { id: 'email', icon: Mail, color: 'text-red-600 bg-red-50', priority: 'recommended' },
  {
    id: 'google-calendar',
    icon: Link2,
    color: 'text-cyan-600 bg-cyan-50',
    priority: 'recommended',
  },
  { id: 'google-reviews', icon: Star, color: 'text-yellow-600 bg-yellow-50', priority: 'optional' },
  {
    id: 'patient-portal',
    icon: Users,
    color: 'text-violet-600 bg-violet-50',
    priority: 'recommended',
  },
  { id: 'ai', icon: Sparkles, color: 'text-amber-600 bg-amber-50', priority: 'optional' },
  { id: 'devices', icon: Cpu, color: 'text-slate-600 bg-slate-50', priority: 'optional' },
  { id: 'video', icon: Video, color: 'text-rose-600 bg-rose-50', priority: 'optional' },
  { id: 'security', icon: Shield, color: 'text-teal-600 bg-teal-50', priority: 'recommended' },
  {
    id: 'data-import',
    icon: Upload,
    color: 'text-emerald-600 bg-emerald-50',
    priority: 'optional',
  },
]

function PriorityBadge({ priority }: { priority: string }) {
  const t = useTranslations('settings.setupGuide')
  const styles = {
    essential: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    recommended: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    optional: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  }
  return (
    <Badge
      className={styles[priority as keyof typeof styles] || styles.optional}
      variant="secondary"
    >
      {t(`priority.${priority}`)}
    </Badge>
  )
}

function GuideSection({ guide, index }: { guide: SetupStep; index: number }) {
  const t = useTranslations('settings.setupGuide')
  const [open, setOpen] = useState(false)

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
      >
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{guide.title}</p>
          <p className="text-xs text-muted-foreground truncate">{guide.description}</p>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t bg-accent/20">
          <div className="mt-3 space-y-4">
            {/* Steps */}
            <div>
              <p className="text-sm font-medium mb-2">{t('stepsLabel')}</p>
              <ol className="space-y-1.5 ml-1">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground shrink-0 w-5 text-right">
                      {step.startsWith('  ') ? '' : `${i + 1}.`}
                    </span>
                    <span className={step.startsWith('  ') ? 'ml-5' : ''}>
                      {step.replace(/^\s+/, '')}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Tips */}
            {guide.tips && guide.tips.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-1.5">
                  {t('tipsLabel')}
                </p>
                <ul className="space-y-1">
                  {guide.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-500 flex gap-1.5">
                      <span className="shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap gap-2 pt-1">
              {guide.link && (
                <Link href={guide.link.href}>
                  <Button size="sm" variant="default">
                    {guide.link.label}
                    <ArrowLeft className="w-3 h-3 ml-1 rotate-180" />
                  </Button>
                </Link>
              )}
              {guide.externalLinks?.map((extLink, i) => (
                <a key={i} href={extLink.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    {extLink.label}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SetupGuidePage() {
  const t = useTranslations('settings.setupGuide')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['clinic']))
  const [filter, setFilter] = useState<'all' | Priority>('all')

  // Merge presentation metadata with the translated content from the catalogue.
  const setupSections: SetupSection[] = SECTION_META.map((meta) => ({
    ...meta,
    ...(t.raw(`sections.${meta.id}`) as Pick<
      SetupSection,
      'title' | 'description' | 'estimatedTime' | 'guides'
    >),
  }))

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => setExpandedSections(new Set(setupSections.map((s) => s.id)))
  const collapseAll = () => setExpandedSections(new Set())

  const filteredSections =
    filter === 'all' ? setupSections : setupSections.filter((s) => s.priority === filter)

  const essentialCount = SECTION_META.filter((s) => s.priority === 'essential').length
  const recommendedCount = SECTION_META.filter((s) => s.priority === 'recommended').length
  const optionalCount = SECTION_META.filter((s) => s.priority === 'optional').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="w-4 h-4" />
              {t('back')}
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <BookOpen className="w-7 h-7" />
          {t('title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${filter === 'essential' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setFilter(filter === 'essential' ? 'all' : 'essential')}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{essentialCount}</p>
                <p className="text-xs text-muted-foreground">{t('essentialSteps')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${filter === 'recommended' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setFilter(filter === 'recommended' ? 'all' : 'recommended')}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Circle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recommendedCount}</p>
                <p className="text-xs text-muted-foreground">{t('recommended')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${filter === 'optional' ? 'ring-2 ring-neutral-500' : ''}`}
          onClick={() => setFilter(filter === 'optional' ? 'all' : 'optional')}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <Circle className="w-5 h-5 text-neutral-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{optionalCount}</p>
                <p className="text-xs text-muted-foreground">{t('optional')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={expandAll}>
          {t('expandAll')}
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          {t('collapseAll')}
        </Button>
        {filter !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>
            {t('clearFilter')}
          </Button>
        )}
      </div>

      {/* Setup Sections */}
      <div className="space-y-4">
        {filteredSections.map((section) => {
          const Icon = section.icon
          const isExpanded = expandedSections.has(section.id)

          return (
            <Card key={section.id}>
              <button onClick={() => toggleSection(section.id)} className="w-full text-left">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${section.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <CardTitle className="text-base">{section.title}</CardTitle>
                        <PriorityBadge priority={section.priority} />
                        <span className="text-xs text-muted-foreground">
                          ~{section.estimatedTime}
                        </span>
                      </div>
                      <CardDescription className="text-sm">{section.description}</CardDescription>
                    </div>
                    <div className="shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </button>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-3 mt-2">
                    {section.guides.map((guide, i) => (
                      <GuideSection key={i} guide={guide} index={i} />
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Help Footer */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="text-center">
            <h3 className="font-semibold mb-1">{t('helpTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-3">{t('helpBody')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/chat">
                <Button variant="default" size="sm">
                  <MessageSquare className="w-4 h-4 mr-1" />
                  {t('askAi')}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
