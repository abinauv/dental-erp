'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  InventoryItemForm,
  emptyInventoryItem,
  type InventoryItemFormValues,
} from '@/components/inventory/item-form'

export default function NewInventoryItemPage() {
  const router = useRouter()
  const t = useTranslations('inventory.new')
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (formData: InventoryItemFormValues) => {
    setLoading(true)

    try {
      const response = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        toast({ title: t('createSuccess') })
        router.push('/inventory')
      } else {
        toast({ title: data.error || t('createFailed'), variant: 'destructive' })
      }
    } catch (error) {
      console.error('Error creating inventory item:', error)
      toast({ title: t('createFailed'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <Link
          href="/inventory"
          className="px-4 py-2 bg-muted-foreground text-white rounded-lg hover:bg-muted-foreground/80"
        >
          {t('backToInventory')}
        </Link>
      </div>

      <InventoryItemForm
        mode="create"
        initialValues={emptyInventoryItem}
        saving={loading}
        cancelHref="/inventory"
        onSubmit={handleSubmit}
      />
    </div>
  )
}
