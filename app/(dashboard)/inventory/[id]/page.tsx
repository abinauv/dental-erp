'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Edit, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

const STATUS_STYLES: Record<string, string> = {
  out_of_stock: 'bg-red-100 text-red-700',
  low_stock: 'bg-orange-100 text-orange-700',
  reorder: 'bg-yellow-100 text-yellow-700',
  sufficient: 'bg-green-100 text-green-700',
}

interface ItemDetail {
  id: string
  sku: string
  name: string
  itemType: string
  unit: string
  description: string | null
  notes: string | null
  currentStock: number
  minimumStock: number
  reorderLevel: number
  maximumStock: number | null
  purchasePrice: string | number
  sellingPrice: string | number
  taxPercentage: string | number
  hsnCode: string | null
  storageLocation: string | null
  expiryTracking: boolean
  batchTracking: boolean
  isActive: boolean
  categoryName: string | null
  supplierName: string | null
  supplierPhone: string | null
  supplierEmail: string | null
  stockStatus: string
  purchasesLast30Days: number
  usageLast30Days: number
  batches: {
    id: string
    batchNumber: string
    remainingQty: number
    quantity: number
    expiryDate: string | null
    receivedDate: string
    supplierName: string | null
  }[]
  recentTransactions: {
    id: string
    type: string
    quantity: number
    newStock: number
    transactionDate: string
    supplierName: string | null
    performedByName: string | null
  }[]
}

export default function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const t = useTranslations('inventory.detail')
  const tStatus = useTranslations('inventory.stockStatus')
  const tType = useTranslations('inventory.itemType')
  const { formatDate, formatCurrency } = useClinicFormatters()
  const [item, setItem] = useState<ItemDetail | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/inventory/items/${id}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.data) setNotFound(true)
        else setItem(json.data)
      })
      .catch(() => setNotFound(true))
  }, [id])

  if (notFound) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <p className="text-muted-foreground">{t('notFound')}</p>
          <Button asChild variant="outline">
            <Link href="/inventory">{t('backToInventory')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!item) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  const typeLabel = (type: string) => (t.has(`txType.${type}`) ? t(`txType.${type}`) : type)
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-bold">{item.name}</h1>
          <p className="text-muted-foreground">
            {item.sku}
            {item.categoryName ? ` · ${item.categoryName}` : ''}
          </p>
        </div>
        <div className="page-actions">
          <Button asChild variant="outline">
            <Link href={`/inventory/transactions?item=${item.id}`}>
              <History className="h-4 w-4 mr-2" />
              {t('stockHistory')}
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/inventory/${item.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              {t('edit')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              {t('stock')}
              <Badge className={`${STATUS_STYLES[item.stockStatus] ?? ''} border-0`}>
                {tStatus.has(item.stockStatus) ? tStatus(item.stockStatus) : item.stockStatus}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {item.currentStock}{' '}
              <span className="text-base font-normal text-muted-foreground">{item.unit}</span>
            </p>
            <div className="mt-4 divide-y">
              {row(t('minimumStock'), item.minimumStock)}
              {row(t('reorderLevel'), item.reorderLevel)}
              {row(t('maximumStock'), item.maximumStock ?? '-')}
              {row(t('purchases30'), item.purchasesLast30Days)}
              {row(t('usage30'), item.usageLast30Days)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('details')}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {row(t('type'), tType.has(item.itemType) ? tType(item.itemType) : item.itemType)}
            {row(t('purchasePrice'), formatCurrency(item.purchasePrice))}
            {row(t('sellingPrice'), formatCurrency(item.sellingPrice))}
            {row(t('tax'), `${Number(item.taxPercentage)}%`)}
            {row(t('hsnCode'), item.hsnCode || '-')}
            {row(t('location'), item.storageLocation || '-')}
            {row(
              t('tracking'),
              [item.expiryTracking && t('expiryTracking'), item.batchTracking && t('batchTracking')]
                .filter(Boolean)
                .join(', ') || t('none')
            )}
            {row(t('status'), item.isActive ? t('active') : t('inactive'))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('supplier')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {item.supplierName ? (
              <>
                <p className="font-medium">{item.supplierName}</p>
                {item.supplierPhone && (
                  <p className="text-muted-foreground">{item.supplierPhone}</p>
                )}
                {item.supplierEmail && (
                  <p className="text-muted-foreground">{item.supplierEmail}</p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">{t('noSupplier')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {(item.description || item.notes) && (
        <Card>
          <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
            {item.description && (
              <div>
                <h2 className="mb-1 text-sm font-medium text-muted-foreground">
                  {t('description')}
                </h2>
                <p className="whitespace-pre-wrap text-sm">{item.description}</p>
              </div>
            )}
            {item.notes && (
              <div>
                <h2 className="mb-1 text-sm font-medium text-muted-foreground">{t('notes')}</h2>
                <p className="whitespace-pre-wrap text-sm">{item.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('transactions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {item.recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noTransactions')}</p>
          ) : (
            <div className="table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colDate')}</TableHead>
                    <TableHead>{t('colType')}</TableHead>
                    <TableHead className="text-right">{t('colQuantity')}</TableHead>
                    <TableHead className="text-right">{t('colStockAfter')}</TableHead>
                    <TableHead>{t('colSupplier')}</TableHead>
                    <TableHead>{t('colBy')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.recentTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDate(tx.transactionDate)}</TableCell>
                      <TableCell>{typeLabel(tx.type)}</TableCell>
                      <TableCell className="text-right">{tx.quantity}</TableCell>
                      <TableCell className="text-right">{tx.newStock}</TableCell>
                      <TableCell>{tx.supplierName || '-'}</TableCell>
                      <TableCell>{tx.performedByName || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {item.batchTracking && (
        <Card>
          <CardHeader>
            <CardTitle>{t('batches')}</CardTitle>
          </CardHeader>
          <CardContent>
            {item.batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noBatches')}</p>
            ) : (
              <div className="table-responsive">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('colBatch')}</TableHead>
                      <TableHead>{t('colExpiry')}</TableHead>
                      <TableHead className="text-right">{t('colRemaining')}</TableHead>
                      <TableHead>{t('colReceived')}</TableHead>
                      <TableHead>{t('colSupplier')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>{batch.batchNumber}</TableCell>
                        <TableCell>
                          {batch.expiryDate ? formatDate(batch.expiryDate) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.remainingQty} / {batch.quantity}
                        </TableCell>
                        <TableCell>{formatDate(batch.receivedDate)}</TableCell>
                        <TableCell>{batch.supplierName || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
