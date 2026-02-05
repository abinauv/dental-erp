import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  Users,
  Calendar,
  Receipt,
  Package,
  BarChart3,
  Shield,
  Zap,
  Clock,
  Building2,
} from "lucide-react"

const features = [
  {
    icon: Users,
    title: "Patient Management",
    description: "Complete patient records with medical history, treatment plans, and dental charts.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Intuitive appointment booking with conflict detection and automated reminders.",
  },
  {
    icon: Receipt,
    title: "Billing & Invoicing",
    description: "Generate invoices, track payments, and manage insurance claims effortlessly.",
  },
  {
    icon: Package,
    title: "Inventory Control",
    description: "Track dental supplies, set reorder alerts, and manage purchase orders.",
  },
  {
    icon: BarChart3,
    title: "Detailed Reports",
    description: "Comprehensive analytics on revenue, patient trends, and staff performance.",
  },
  {
    icon: Shield,
    title: "Secure & Compliant",
    description: "Role-based access control with audit logs to keep your data safe.",
  },
]

const plans = [
  {
    name: "Free",
    price: "0",
    description: "Perfect for getting started",
    features: ["Up to 100 patients", "3 staff members", "Basic reports", "Email support"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Professional",
    price: "2,999",
    description: "For growing practices",
    features: [
      "Unlimited patients",
      "Unlimited staff",
      "Advanced analytics",
      "Priority support",
      "Custom branding",
    ],
    cta: "Start Trial",
    popular: true,
  },
  {
    name: "Self-Hosted",
    price: "49,999",
    priceNote: "one-time",
    description: "Own your data forever",
    features: [
      "Full source code",
      "Host on your servers",
      "No recurring fees",
      "1 year of updates",
    ],
    cta: "Contact Sales",
    popular: false,
  },
]

export default async function LandingPage() {
  const session = await auth()

  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              D
            </div>
            <span className="font-semibold">DentalERP</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
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

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container py-24 md:py-32">
          <div className="flex flex-col items-center text-center space-y-8">
            <Badge variant="secondary" className="px-4 py-1">
              <Zap className="mr-1 h-3 w-3" />
              Now with AI-powered insights
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              The Complete Dental
              <br />
              <span className="text-primary">Practice Management</span> Solution
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
              Streamline your dental practice with our all-in-one ERP system. From patient
              management to billing, everything you need in one place.
            </p>
            <div className="flex gap-4">
              <Link href="/signup">
                <Button size="lg" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline">
                  View Pricing
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Setup in 5 minutes
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                100 patients free
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container py-24 bg-muted/30">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to run your practice
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Powerful features designed specifically for dental clinics
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="border-0 shadow-sm">
                  <CardHeader>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Pricing Preview Section */}
        <section className="container py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free, upgrade when you grow
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={plan.popular ? "border-primary shadow-lg relative" : ""}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">
                      {plan.price === "Custom" ? "" : "₹"}
                      {plan.price}
                    </span>
                    {plan.priceNote ? (
                      <span className="text-muted-foreground"> {plan.priceNote}</span>
                    ) : plan.price !== "0" ? (
                      <span className="text-muted-foreground">/month</span>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className="block">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container py-24">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="flex flex-col items-center text-center py-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to transform your practice?
              </h2>
              <p className="mt-4 text-lg opacity-90 max-w-xl">
                Join hundreds of dental clinics already using DentalERP to streamline their
                operations and grow their practice.
              </p>
              <div className="mt-8 flex gap-4">
                <Link href="/signup">
                  <Button size="lg" variant="secondary">
                    Start Your Free Trial
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xs">
              D
            </div>
            <span className="text-sm text-muted-foreground">
              DentalERP - Dental Practice Management
            </span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Get Started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
