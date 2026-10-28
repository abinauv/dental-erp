'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'
import { useToast } from '@/hooks/use-toast'

const emptySupplierForm = {
  code: '',
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  alternatePhone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstNumber: '',
  panNumber: '',
  paymentTerms: 'Net 30',
  creditLimit: '',
  notes: '',
}

interface Supplier {
  id: number
  code: string
  name: string
  contactPerson: string
  phone: string
  email: string
  city: string
  status: string
  itemsSupplied: number
  totalOrders: number
  totalBusiness: number
}

export default function SuppliersPage() {
  const router = useRouter()
  const t = useTranslations('inventory.suppliers')
  const tStatus = useTranslations('inventory.supplierStatus')
  const tForm = useTranslations('inventory.suppliers.form')
  const { toast } = useToast()
  const fmt = useClinicFormatters()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  })

  useEffect(() => {
    fetchSuppliers()
  }, [search, statusFilter, pagination.page])

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })

      const response = await fetch(`/api/inventory/suppliers?${params}`)
      const data = await response.json()

      if (data.success) {
        setSuppliers(data.data)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setSupplierForm(emptySupplierForm)
    setShowAddModal(true)
  }

  const setField = (key: keyof typeof emptySupplierForm, value: string) =>
    setSupplierForm((prev) => ({ ...prev, [key]: value }))

  const handleCreateSupplier = async () => {
    if (!supplierForm.code.trim() || !supplierForm.name.trim() || !supplierForm.phone.trim()) {
      toast({ title: tForm('requiredError'), variant: 'destructive' })
      return
    }
    setSavingSupplier(true)
    try {
      const res = await fetch('/api/inventory/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...supplierForm,
          creditLimit: supplierForm.creditLimit ? Number(supplierForm.creditLimit) : 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          res.status === 409 ? tForm('codeExists') : data.error || tForm('createError')
        )
      }
      toast({ title: tForm('createSuccess') })
      setShowAddModal(false)
      setSupplierForm(emptySupplierForm)
      fetchSuppliers()
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : tForm('createError'),
        variant: 'destructive',
      })
    } finally {
      setSavingSupplier(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      ACTIVE: 'bg-green-100 text-green-800',
      INACTIVE: 'bg-muted text-foreground',
      BLOCKED: 'bg-red-100 text-red-800',
    }

    const label = tStatus.has(status)
      ? tStatus(status)
      : status.charAt(0) + status.slice(1).toLowerCase()
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${badges[status as keyof typeof badges]}`}
      >
        {label}
      </span>
    )
  }

  const formatCurrency = (amount: number) =>
    fmt.formatCurrency(amount, { minimumFractionDigits: 0 })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <div className="flex gap-2">
          <Link
            href="/inventory"
            className="px-4 py-2 bg-muted-foreground text-background rounded-lg hover:bg-muted-foreground/80"
          >
            {t('backToInventory')}
          </Link>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + {t('addSupplier')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-background rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('allStatus')}</option>
            <option value="ACTIVE">{tStatus('ACTIVE')}</option>
            <option value="INACTIVE">{tStatus('INACTIVE')}</option>
            <option value="BLOCKED">{tStatus('BLOCKED')}</option>
          </select>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-background rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">{t('loading')}</div>
        ) : suppliers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{t('noSuppliers')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colCode')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colName')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colContactPerson')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colPhone')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colEmail')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colStatus')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colItems')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colTotalBusiness')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('colActions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                        {supplier.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {supplier.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {supplier.contactPerson || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {supplier.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {supplier.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(supplier.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {supplier.itemsSupplied}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {formatCurrency(supplier.totalBusiness)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/inventory/suppliers/${supplier.id}`}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          {t('view')}
                        </Link>
                        <Link
                          href={`/inventory/suppliers/${supplier.id}/edit`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {t('edit')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-background px-4 py-3 flex items-center justify-between border-t border-border sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-foreground">
                    {t('showingPage', {
                      page: pagination.page,
                      pages: pagination.pages,
                      total: pagination.total,
                    })}
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      {t('previous')}
                    </button>
                    <button
                      onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                      disabled={pagination.page === pagination.pages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      {t('next')}
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-1">{t('addModalTitle')}</h2>
            <p className="text-muted-foreground mb-4 text-sm">{t('addModalDesc')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  ['code', true],
                  ['name', true],
                  ['contactPerson', false],
                  ['phone', true],
                  ['email', false],
                  ['alternatePhone', false],
                  ['city', false],
                  ['state', false],
                  ['pincode', false],
                  ['gstNumber', false],
                  ['panNumber', false],
                  ['paymentTerms', false],
                  ['creditLimit', false],
                ] as const
              ).map(([field, required]) => (
                <div key={field} className="space-y-1">
                  <label htmlFor={`sup-${field}`} className="text-sm font-medium">
                    {tForm(field)}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    id={`sup-${field}`}
                    type={field === 'creditLimit' ? 'number' : field === 'email' ? 'email' : 'text'}
                    value={supplierForm[field]}
                    onChange={(e) => setField(field, e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ))}
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="sup-address" className="text-sm font-medium">
                  {tForm('address')}
                </label>
                <input
                  id="sup-address"
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="sup-notes" className="text-sm font-medium">
                  {tForm('notes')}
                </label>
                <textarea
                  id="sup-notes"
                  rows={2}
                  value={supplierForm.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={savingSupplier}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted/50 disabled:opacity-50"
              >
                {tForm('cancel')}
              </button>
              <button
                onClick={handleCreateSupplier}
                disabled={savingSupplier}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {savingSupplier ? tForm('saving') : tForm('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
