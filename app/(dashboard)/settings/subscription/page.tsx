"use client"

import { useState, useEffect } from "react"
import { Check, Crown, Building2, Zap, Server } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Plan = "FREE" | "PROFESSIONAL" | "ENTERPRISE" | "SELF_HOSTED"

type HospitalData = {
  name: string
  plan: Plan
  maxPatients: number
  maxStaff: number
  maxStorageMB: number
  currentPatients: number
  currentStaff: number
  currentStorageMB: number
}

const plans = [
  {
    id: "FREE" as Plan,
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
    ],
    limits: {
      patients: 100,
      staff: 3,
      storage: 500,
    },
  },
  {
    id: "PROFESSIONAL" as Plan,
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
    ],
    limits: {
      patients: -1,
      staff: -1,
      storage: -1,
    },
  },
  {
    id: "ENTERPRISE" as Plan,
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    icon: Crown,
    features: [
      "Everything in Professional",
      "Multi-location support",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "On-premise option",
    ],
    limits: {
      patients: -1,
      staff: -1,
      storage: -1,
    },
  },
  {
    id: "SELF_HOSTED" as Plan,
    name: "Self-Hosted",
    price: "49,999",
    priceNote: "one-time",
    description: "Own your data forever",
    icon: Server,
    features: [
      "Full source code access",
      "Host on your servers",
      "Unlimited everything",
      "1 year of updates",
      "Installation support",
      "No recurring fees",
    ],
    limits: {
      patients: -1,
      staff: -1,
      storage: -1,
    },
  },
]

export default function SubscriptionPage() {
  const { toast } = useToast()
  const [hospitalData, setHospitalData] = useState<HospitalData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchHospitalData()
  }, [])

  const fetchHospitalData = async () => {
    try {
      const response = await fetch("/api/settings/subscription")
      if (response.ok) {
        const data = await response.json()
        setHospitalData(data)
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load subscription data.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpgrade = async (planId: Plan) => {
    // In production, this would redirect to a payment page
    toast({
      title: "Upgrade requested",
      description: "Our team will contact you shortly to complete the upgrade.",
    })
  }

  const getUsagePercentage = (current: number, max: number) => {
    if (max === -1) return 0 // Unlimited
    return Math.min((current / max) * 100, 100)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription & Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and view usage
        </p>
      </div>

      {/* Current Plan Usage */}
      {hospitalData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Your current usage and limits</CardDescription>
              </div>
              <Badge
                variant={hospitalData.plan === "FREE" ? "secondary" : "default"}
                className="text-sm"
              >
                {hospitalData.plan === "FREE"
                  ? "Free Plan"
                  : hospitalData.plan === "PROFESSIONAL"
                  ? "Professional"
                  : hospitalData.plan === "ENTERPRISE"
                  ? "Enterprise"
                  : "Self-Hosted"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Patients Usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Patients</span>
                <span className="text-muted-foreground">
                  {hospitalData.currentPatients} /{" "}
                  {hospitalData.maxPatients === -1
                    ? "Unlimited"
                    : hospitalData.maxPatients}
                </span>
              </div>
              {hospitalData.maxPatients !== -1 && (
                <Progress
                  value={getUsagePercentage(
                    hospitalData.currentPatients,
                    hospitalData.maxPatients
                  )}
                  className={cn(
                    getUsagePercentage(
                      hospitalData.currentPatients,
                      hospitalData.maxPatients
                    ) > 80
                      ? "[&>div]:bg-destructive"
                      : ""
                  )}
                />
              )}
            </div>

            {/* Staff Usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Staff Members</span>
                <span className="text-muted-foreground">
                  {hospitalData.currentStaff} /{" "}
                  {hospitalData.maxStaff === -1
                    ? "Unlimited"
                    : hospitalData.maxStaff}
                </span>
              </div>
              {hospitalData.maxStaff !== -1 && (
                <Progress
                  value={getUsagePercentage(
                    hospitalData.currentStaff,
                    hospitalData.maxStaff
                  )}
                  className={cn(
                    getUsagePercentage(
                      hospitalData.currentStaff,
                      hospitalData.maxStaff
                    ) > 80
                      ? "[&>div]:bg-destructive"
                      : ""
                  )}
                />
              )}
            </div>

            {/* Storage Usage */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Storage</span>
                <span className="text-muted-foreground">
                  {hospitalData.currentStorageMB} MB /{" "}
                  {hospitalData.maxStorageMB === -1
                    ? "Unlimited"
                    : `${hospitalData.maxStorageMB} MB`}
                </span>
              </div>
              {hospitalData.maxStorageMB !== -1 && (
                <Progress
                  value={getUsagePercentage(
                    hospitalData.currentStorageMB,
                    hospitalData.maxStorageMB
                  )}
                  className={cn(
                    getUsagePercentage(
                      hospitalData.currentStorageMB,
                      hospitalData.maxStorageMB
                    ) > 80
                      ? "[&>div]:bg-destructive"
                      : ""
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const Icon = plan.icon
            const isCurrent = hospitalData?.plan === plan.id

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative",
                  plan.popular && "border-primary shadow-md",
                  isCurrent && "bg-muted/50"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        plan.popular
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">
                      {plan.price === "Custom" ? "" : "₹"}
                      {plan.price}
                    </span>
                    {plan.priceNote ? (
                      <span className="text-muted-foreground">
                        {" "}
                        {plan.priceNote}
                      </span>
                    ) : plan.price !== "Custom" && plan.price !== "0" ? (
                      <span className="text-muted-foreground">/month</span>
                    ) : null}
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : plan.popular ? "default" : "outline"}
                    disabled={isCurrent}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isCurrent
                      ? "Current Plan"
                      : plan.price === "Custom"
                      ? "Contact Sales"
                      : "Upgrade"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
