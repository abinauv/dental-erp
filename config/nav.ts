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
  Sparkles,
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
      },
      {
        title: "Treatments",
        href: "/treatments",
        icon: Stethoscope,
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
            title: "Insurance Claims",
            href: "/billing/insurance",
            icon: Shield,
            roles: ["ADMIN", "ACCOUNTANT"],
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
    title: "Operations",
    items: [
      {
        title: "Inventory",
        href: "/inventory",
        icon: Package,
        roles: ["ADMIN"],
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
