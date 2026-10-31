import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Building2, Zap, Crown, Server, ArrowLeft } from 'lucide-react'
import { createFormatters } from '@/lib/i18n/format'

// Static plan config; display copy (name, description, features, cta) lives in
// the catalogue under auth.pricing.plans.<id>. `price` is a numeric INR amount
// (the product's pricing currency) or null for the quote-based Enterprise plan.
const PLAN_CONFIG = [
  { id: 'FREE', price: 0, icon: Building2, ctaVariant: 'outline' as const },
  { id: 'PROFESSIONAL', price: 2999, icon: Zap, popular: true, ctaVariant: 'default' as const },
  { id: 'ENTERPRISE', price: null, icon: Crown, ctaVariant: 'outline' as const },
  { id: 'SELF_HOSTED', price: 49999, oneTime: true, icon: Server, ctaVariant: 'outline' as const },
]

export default async function PricingPage() {
  const t = await getTranslations('auth.pricing')
  const locale = await getLocale()
  // Marketing prices are in INR regardless of viewer locale; the locale only
  // affects digit grouping.
  const { formatCurrency } = createFormatters(locale, 'INR')
  const faqs = t.raw('faqs') as { question: string; answer: string }[]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              D
            </div>
            <span className="font-semibold">DentalERP</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                {t('signIn')}
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">{t('getStarted')}</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="container py-16">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToHome')}
        </Link>

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t('heroTitle')}</h1>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 lg:grid-cols-4 max-w-7xl mx-auto">
          {PLAN_CONFIG.map((plan) => {
            const Icon = plan.icon
            const features = t.raw(`plans.${plan.id}.features`) as string[]
            const isCustom = plan.price === null
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  plan.popular ? 'border-primary shadow-lg scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">{t('mostPopular')}</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        plan.popular ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <CardTitle className="text-xl">{t(`plans.${plan.id}.name`)}</CardTitle>
                  <CardDescription>{t(`plans.${plan.id}.description`)}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">
                      {isCustom ? t('custom') : formatCurrency(plan.price)}
                    </span>
                    {plan.oneTime ? (
                      <span className="text-muted-foreground"> {t('oneTime')}</span>
                    ) : !isCustom && plan.price !== 0 ? (
                      <span className="text-muted-foreground">{t('perMonth')}</span>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/signup" className="w-full">
                    <Button className="w-full" variant={plan.ctaVariant}>
                      {t(`plans.${plan.id}.cta`)}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">{t('faqTitle')}</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <Card key={faq.question}>
                <CardHeader>
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 text-center">
          <Card className="bg-primary text-primary-foreground max-w-3xl mx-auto">
            <CardContent className="py-12">
              <h2 className="text-2xl font-bold mb-4">{t('ctaTitle')}</h2>
              <p className="text-lg opacity-90 mb-8">{t('ctaSubtitle')}</p>
              <Link href="/signup">
                <Button size="lg" variant="secondary">
                  {t('createFreeAccount')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-24 py-8">
        <div className="container text-center text-sm text-muted-foreground">{t('footer')}</div>
      </footer>
    </div>
  )
}
