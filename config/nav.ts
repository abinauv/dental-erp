import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Receipt,
  Package,
  FlaskConical,
  UserCog,
  BarChart3,
  Settings,
  FileText,
  CreditCard,
  Shield,
  TrendingUp,
  MessageSquare,
  BotMessageSquare,
  Sparkles,
  Pill,
  ClipboardList,
  ClipboardCheck,
  Building2,
  FileCheck,
  Heart,
  Crown,
  Gift,
  Share2,
  Clock,
  Link2,
  CalendarClock,
  Video,
  Zap,
  Star,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  roles?: string[]
  badge?: string
  subItems?: NavItem[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: "Overview",
    items: [
      {
        title: "AI Chat",
        href: "/chat",
        icon: BotMessageSquare,
      },
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Patient Care",
    items: [
      {
        title: "Patients",
        href: "/patients",
        icon: Users,
      },
      {
        title: "Appointments",
        href: "/appointments",
        icon: Calendar,
        subItems: [
          {
            title: "All Appointments",
            href: "/appointments",
            icon: Calendar,
          },
          {
            title: "Waitlist",
            href: "/appointments/waitlist",
            icon: Clock,
            roles: ["ADMIN", "RECEPTIONIST"],
          },
        ],
      },
      {
        title: "Video Consults",
        href: "/video",
        icon: Video,
        roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"],
      },
      {
        title: "Treatments",
        href: "/treatments",
        icon: Stethoscope,
        roles: ["ADMIN", "DOCTOR"],
      },
      {
        title: "Prescriptions",
        href: "/prescriptions",
        icon: ClipboardList,
        roles: ["ADMIN", "DOCTOR"],
      },
      {
        title: "Drug Catalog",
        href: "/medications",
        icon: Pill,
        roles: ["ADMIN", "DOCTOR"],
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        title: "Billing",
        href: "/billing",
        icon: Receipt,
        roles: ["ADMIN", "ACCOUNTANT", "RECEPTIONIST"],
        subItems: [
          {
            title: "Overview",
            href: "/billing",
            icon: Receipt,
          },
          {
            title: "Invoices",
            href: "/billing/invoices",
            icon: FileText,
          },
          {
            title: "Payments",
            href: "/billing/payments",
            icon: CreditCard,
          },
          {
            title: "Payment Plans",
            href: "/billing/payment-plans",
            icon: CalendarClock,
            roles: ["ADMIN", "ACCOUNTANT", "RECEPTIONIST"],
          },
          {
            title: "Insurance Claims",
            href: "/billing/insurance",
            icon: Shield,
            roles: ["ADMIN", "ACCOUNTANT"],
          },
          {
            title: "Pre-Authorizations",
            href: "/billing/insurance/pre-auth",
            icon: FileCheck,
            roles: ["ADMIN", "ACCOUNTANT"],
          },
          {
            title: "Insurance Providers",
            href: "/billing/insurance/providers",
            icon: Building2,
            roles: ["ADMIN"],
          },
          {
            title: "Financial Reports",
            href: "/billing/reports",
            icon: TrendingUp,
            roles: ["ADMIN", "ACCOUNTANT"],
          },
        ],
      },
    ],
  },
  {
    title: "Engagement",
    items: [
      {
        title: "CRM",
        href: "/crm",
        icon: Heart,
        roles: ["ADMIN", "RECEPTIONIST"],
        subItems: [
          {
            title: "Dashboard",
            href: "/crm",
            icon: Heart,
          },
          {
            title: "Memberships",
            href: "/crm/memberships",
            icon: Crown,
          },
          {
            title: "Loyalty",
            href: "/crm/loyalty",
            icon: Gift,
          },
          {
            title: "Referrals",
            href: "/crm/referrals",
            icon: Share2,
          },
          {
            title: "Segments",
            href: "/crm/segments",
            icon: Users,
            roles: ["ADMIN"],
          },
        ],
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        title: "Inventory",
        href: "/inventory",
        icon: Package,
        roles: ["ADMIN"],
      },
      {
        title: "Sterilization",
        href: "/sterilization",
        icon: Shield,
        roles: ["ADMIN", "DOCTOR"],
        subItems: [
          {
            title: "Dashboard",
            href: "/sterilization",
            icon: Shield,
          },
          {
            title: "Instruments",
            href: "/sterilization/instruments",
            icon: Package,
          },
          {
            title: "Cycle Logs",
            href: "/sterilization/logs",
            icon: ClipboardList,
          },
          {
            title: "Compliance",
            href: "/sterilization/reports",
            icon: BarChart3,
            roles: ["ADMIN"],
          },
        ],
      },
      {
        title: "Lab Orders",
        href: "/lab",
        icon: FlaskConical,
        roles: ["ADMIN", "DOCTOR", "LAB_TECH"],
      },
      {
        title: "Communications",
        href: "/communications",
        icon: MessageSquare,
        roles: ["ADMIN", "RECEPTIONIST"],
        subItems: [
          {
            title: "Send Messages",
            href: "/communications",
            icon: MessageSquare,
          },
          {
            title: "Analytics",
            href: "/communications/analytics",
            icon: BarChart3,
            roles: ["ADMIN"],
          },
          {
            title: "Automations",
            href: "/communications/automations",
            icon: Zap,
            roles: ["ADMIN"],
          },
          {
            title: "Feedback",
            href: "/communications/feedback",
            icon: Star,
            roles: ["ADMIN"],
          },
        ],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        title: "Staff",
        href: "/staff",
        icon: UserCog,
        roles: ["ADMIN"],
        subItems: [
          {
            title: "All Staff",
            href: "/staff",
            icon: UserCog,
          },
          {
            title: "Invites",
            href: "/staff/invites",
            icon: UserCog,
          },
          {
            title: "Attendance",
            href: "/staff/attendance",
            icon: Calendar,
          },
          {
            title: "Leaves",
            href: "/staff/leaves",
            icon: Calendar,
          },
        ],
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        roles: ["ADMIN", "ACCOUNTANT", "DOCTOR"],
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["ADMIN"],
        subItems: [
          {
            title: "General",
            href: "/settings",
            icon: Settings,
          },
          {
            title: "AI Features",
            href: "/settings/ai",
            icon: Sparkles,
          },
          {
            title: "Forms",
            href: "/settings/forms",
            icon: ClipboardCheck,
          },
          {
            title: "Integrations",
            href: "/settings/integrations",
            icon: Link2,
          },
        ],
      },
    ],
  },
]

export function getNavigationForRole(role: string): NavSection[] {
  return navigation
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !item.roles || item.roles.includes(role))
        .map((item) => ({
          ...item,
          subItems: item.subItems?.filter(
            (subItem) => !subItem.roles || subItem.roles.includes(role)
          ),
        })),
    }))
    .filter((section) => section.items.length > 0)
}
