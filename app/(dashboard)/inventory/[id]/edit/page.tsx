'use client'

import { use, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { InventoryItemForm, type InventoryItemFormValues } from '@/components/inventory/item-form'

// The API's item (GET /api/inventory/items/[id]) as form values.
function toFormValues(item: Record<string, any>): InventoryItemFormValues {
  const text = (value: unknown) => (value == null ? '' : String(value))
  return {
    sku: text(item.sku),
    name: text(item.name),
    categoryId: text(item.categoryId),
    itemType: text(item.itemType) || 'DENTAL_MATERIAL',
    description: text(item.description),
    unit: text(item.unit),
    currentStock: Number(item.currentStock) || 0,
    minimumStock: Number(item.minimumStock) || 0,
    reorderLevel: Number(item.reorderLevel) || 0,
    maximumStock: item.maximumStock == null ? '' : Number(item.maximumStock),
    purchasePrice: Number(item.purchasePrice) || 0,
    sellingPrice: Number(item.sellingPrice) || 0,
    hsnCode: text(item.hsnCode),
    taxPercentage: Number(item.taxPercentage) || 0,
    preferredSupplierId: text(item.preferredSupplierId),
    storageLocation: text(item.storageLocation),
    expiryTracking: Boolean(item.expiryTracking),
    batchTracking: Boolean(item.batchTracking),
    isActive: item.isActive !== false,
    notes: text(item.notes),
  }
}

export default function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const t = useTranslations('inventory.edit')
  const { toast } = useToast()
  const [values, setValues] = useState<InventoryItemFormValues | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/inventory/items/${id}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.data) setNotFound(true)
        else setValues(toFormValues(json.data))
      })
      .catch(() => setNotFound(true))
  }, [id])

  const handleSubmit = async (formData: InventoryItemFormValues) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          maximumStock: formData.maximumStock === '' ? null : Number(formData.maximumStock),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: res.status === 409 ? t('codeExists') : data.error || t('updateFailed'),
          variant: 'destructive',
        })
        return
      }
      toast({ title: t('updateSuccess') })
      router.push(`/inventory/${id}`)
    } catch {
      toast({ title: t('updateFailed'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <Link
          href={`/inventory/${id}`}
          className="px-4 py-2 bg-muted-foreground text-white rounded-lg hover:bg-muted-foreground/80"
        >
          {t('backToItem')}
        </Link>
      </div>

      {notFound ? (
        <p className="text-muted-foreground">{t('notFound')}</p>
      ) : values ? (
        <InventoryItemForm
          mode="edit"
          initialValues={values}
          saving={saving}
          cancelHref={`/inventory/${id}`}
          onSubmit={handleSubmit}
        />
      ) : (
        <p className="text-muted-foreground">{t('loading')}</p>
      )}
    </div>
  )
}
