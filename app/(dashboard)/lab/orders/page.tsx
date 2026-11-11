import { redirect } from 'next/navigation'

// Lab orders are listed on /lab; this path exists for the breadcrumb on
// /lab/orders/new and /lab/orders/[id].
export default function LabOrdersPage() {
  redirect('/lab')
}
