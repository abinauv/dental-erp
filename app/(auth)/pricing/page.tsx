import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, Building2, Zap, Crown, Server, ArrowLeft } from "lucide-react"

const plans = [
  {
    id: "FREE",
    name: "Free",
    price: "0",
    description: "Perfect for getting started",
    icon: Building2,
    features: [
      "Up to 100 patients",
      "Up to 3 staff members",
      "500 MB storage",
      "Basic reports",
      "Email support",
      "Patient management",
      "Appointment scheduling",
      "Basic billing",
    ],
    notIncluded: [
      "Advanced analytics",
      "Custom branding",
      "API access",
      "Priority support",
    ],
    cta: "Get Started Free",
    ctaVariant: "outline" as const,
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    price: "2,999",
    description: "For growing practices",
    icon: Zap,
    popular: true,
    features: [
      "Unlimited patients",
      "Unlimited staff",
      "Unlimited storage",
      "Advanced analytics",
      "Priority support",
      "Custom branding",
      "API access",
      "SMS notifications",
      "Insurance claims management",
      "Lab order management",
      "Inventory management",
      "Multi-location support",
    ],
    notIncluded: [],
    cta: "Start 14-Day Trial",
    ctaVariant: "default" as const,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    icon: Crown,
    features: [
      "Everything in Professional",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee (99.9% uptime)",
      "On-premise deployment option",
      "Advanced security features",
      "Custom training sessions",
      "White-label options",
    ],
    notIncluded: [],
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
  },
  {
    id: "SELF_HOSTED",
    name: "Self-Hosted",
    price: "49,999",
    priceNote: "one-time",
    description: "Own your data forever",
    icon: Server,
    features: [
      "Full source code access",
      "Host on your own servers",
      "No recurring fees",
      "Unlimited everything",
      "1 year of updates included",
      "Installation support",
      "Documentation & guides",
      "Community support",
    ],
    notIncluded: [],
    cta: "Purchase License",
    ctaVariant: "outline" as const,
  },
]

const faqs = [
  {
    question: "Can I switch plans later?",
    answer: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to new features. When downgrading, changes take effect at the end of your billing cycle.",
  },
  {
    question: "What happens when I reach my patient limit?",
    answer: "You'll receive a notification when you're approaching your limit. Once reached, you won't be able to add new patients until you upgrade or remove inactive patient records.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer: "Yes, the Professional plan comes with a 14-day free trial. No credit card required. You can explore all features before deciding to subscribe.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit/debit cards, UPI, net banking, and can arrange invoicing for Enterprise customers.",
  },
  {
    question: "Can I get a refund?",
    answer: "We offer a 30-day money-back guarantee for annual subscriptions. If you're not satisfied, contact us for a full refund.",
  },
  {
    question: "What's included in the self-hosted license?",
    answer: "You get the complete source code, Docker deployment scripts, documentation, and one year of updates. After the first year, you can optionally renew for continued updates.",
  },
]

export default function PricingPage() {
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
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
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
          Back to home
        </Link>

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan for your dental practice. Start free and scale as you grow.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 lg:grid-cols-4 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  plan.popular ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        plan.popular
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">
                      {plan.price === "Custom" ? "" : "₹"}
                      {plan.price}
                    </span>
                    {plan.priceNote ? (
                      <span className="text-muted-foreground"> {plan.priceNote}</span>
                    ) : plan.price !== "0" && plan.price !== "Custom" ? (
                      <span className="text-muted-foreground">/month</span>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
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
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently asked questions
          </h2>
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
              <h2 className="text-2xl font-bold mb-4">
                Ready to get started?
              </h2>
              <p className="text-lg opacity-90 mb-8">
                Start with our free plan and upgrade when you need more.
              </p>
              <Link href="/signup">
                <Button size="lg" variant="secondary">
                  Create Free Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-24 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          DentalERP - Complete Dental Practice Management Solution
        </div>
      </footer>
    </div>
  )
}
