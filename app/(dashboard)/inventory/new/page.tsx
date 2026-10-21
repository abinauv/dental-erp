'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

export default function NewInventoryItemPage() {
  const router = useRouter()
  const t = useTranslations('inventory.new')
  const tType = useTranslations('inventory.itemType')
  const { currencySymbol } = useClinicFormatters()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    categoryId: '',
    itemType: 'DENTAL_MATERIAL',
    description: '',
    unit: '',
    currentStock: 0,
    minimumStock: 0,
    reorderLevel: 0,
    maximumStock: '',
    purchasePrice: 0,
    sellingPrice: 0,
    hsnCode: '',
    taxPercentage: 0,
    preferredSupplierId: '',
    storageLocation: '',
    expiryTracking: false,
    batchTracking: false,
    isActive: true,
    notes: '',
  })

  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/inventory/categories')
      const data = await response.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/inventory/suppliers?status=active')
      const data = await response.json()
      if (data.success) {
        setSuppliers(data.data)
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData({ ...formData, [name]: checked })
    } else if (type === 'number') {
      setFormData({ ...formData, [name]: parseFloat(value) || 0 })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        alert(t('createSuccess'))
        router.push('/inventory')
      } else {
        alert(data.error || t('createFailed'))
      }
    } catch (error) {
      console.error('Error creating inventory item:', error)
      alert(t('createFailed'))
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

      <form onSubmit={handleSubmit} className="bg-background rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Item Code */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('itemCode')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('itemCodePlaceholder')}
            />
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('itemName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('itemNamePlaceholder')}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('category')}
            </label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('selectCategory')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Item Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('itemType')} <span className="text-red-500">*</span>
            </label>
            <select
              name="itemType"
              value={formData.itemType}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DENTAL_MATERIAL">{tType('DENTAL_MATERIAL')}</option>
              <option value="INSTRUMENT">{tType('INSTRUMENT')}</option>
              <option value="CONSUMABLE">{tType('CONSUMABLE')}</option>
              <option value="MEDICINE">{tType('MEDICINE')}</option>
              <option value="OFFICE_SUPPLY">{tType('OFFICE_SUPPLY')}</option>
              <option value="EQUIPMENT">{tType('EQUIPMENT')}</option>
            </select>
          </div>

          {/* Unit of Measurement */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('unit')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('unitPlaceholder')}
            />
          </div>

          {/* Current Stock */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('currentStock')}
            </label>
            <input
              type="number"
              name="currentStock"
              value={formData.currentStock}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Minimum Stock */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('minimumStock')}
            </label>
            <input
              type="number"
              name="minimumStock"
              value={formData.minimumStock}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Reorder Point */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('reorderPoint')}
            </label>
            <input
              type="number"
              name="reorderLevel"
              value={formData.reorderLevel}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Maximum Stock */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('maximumStock')}
            </label>
            <input
              type="number"
              name="maximumStock"
              value={formData.maximumStock}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Unit Price */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('unitPrice', { currency: currencySymbol })}
            </label>
            <input
              type="number"
              name="purchasePrice"
              value={formData.purchasePrice}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Selling Price */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('sellingPrice', { currency: currencySymbol })}
            </label>
            <input
              type="number"
              name="sellingPrice"
              value={formData.sellingPrice}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* HSN Code */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t('hsnCode')}</label>
            <input
              type="text"
              name="hsnCode"
              value={formData.hsnCode}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tax Percentage */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('taxPercentage')}
            </label>
            <input
              type="number"
              name="taxPercentage"
              value={formData.taxPercentage}
              onChange={handleChange}
              step="0.01"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Preferred Supplier */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('preferredSupplier')}
            </label>
            <select
              name="preferredSupplierId"
              value={formData.preferredSupplierId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('selectSupplier')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Storage Location */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('storageLocation')}
            </label>
            <input
              type="text"
              name="storageLocation"
              value={formData.storageLocation}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('storagePlaceholder')}
            />
          </div>
        </div>

        {/* Description */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('description')}
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Checkboxes */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="expiryTracking"
              checked={formData.expiryTracking}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">{t('expiryTracking')}</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="batchTracking"
              checked={formData.batchTracking}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">{t('batchTracking')}</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm">{t('active')}</span>
          </label>
        </div>

        {/* Notes */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-foreground mb-2">{t('notes')}</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={2}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex justify-end gap-4">
          <Link
            href="/inventory"
            className="px-6 py-2 border border-border rounded-lg hover:bg-muted"
          >
            {t('cancel')}
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('creating') : t('createItem')}
          </button>
        </div>
      </form>
    </div>
  )
}
