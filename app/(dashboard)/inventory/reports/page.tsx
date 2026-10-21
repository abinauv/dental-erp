'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useClinicFormatters } from '@/components/i18n/clinic-locale-provider'

export default function InventoryReportsPage() {
  const t = useTranslations('inventory.reports')
  const tType = useTranslations('inventory.itemType')
  const tUrgency = useTranslations('inventory.reportUrgency')
  const fmt = useClinicFormatters()
  const [activeReport, setActiveReport] = useState('summary')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [reportParams, setReportParams] = useState({
    days: 30,
  })

  useEffect(() => {
    fetchReport()
  }, [activeReport, reportParams])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: activeReport,
        days: String(reportParams.days),
      })

      const response = await fetch(`/api/inventory/reports?${params}`)
      const data = await response.json()

      if (data.success) {
        setReportData(data.data)
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) =>
    fmt.formatCurrency(amount, { minimumFractionDigits: 0 })

  const urgencyLabel = (urgency: string) =>
    (tUrgency.has(urgency) ? tUrgency(urgency) : urgency.replace('_', ' ')).toUpperCase()

  const renderSummaryReport = () => {
    if (!reportData) return null

    return (
      <div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">{t('totalItems')}</h3>
            <p className="text-3xl font-bold mt-2">{reportData.summary.totalItems}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('activeCount', { count: reportData.summary.activeItems })}
            </p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">{t('outOfStock')}</h3>
            <p className="text-3xl font-bold mt-2 text-red-600">
              {reportData.summary.outOfStockItems}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{t('itemsNeedRestock')}</p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">{t('lowStock')}</h3>
            <p className="text-3xl font-bold mt-2 text-orange-600">
              {reportData.summary.lowStockItems}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{t('itemsBelowMin')}</p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">{t('inventoryValue')}</h3>
            <p className="text-3xl font-bold mt-2 text-green-600">
              {formatCurrency(reportData.summary.totalInventoryValue || 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{t('totalStockValueHint')}</p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-background p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-bold mb-4">{t('byCategory')}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colCategory')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colItemCount')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colCategoryValue')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {reportData.categoryBreakdown.map((cat: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {cat.category || t('uncategorized')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {cat.itemCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {formatCurrency(cat.categoryValue || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Type Breakdown */}
        <div className="bg-background p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">{t('byType')}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colType')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colItemCount')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colTypeValue')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {reportData.typeBreakdown.map((type: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {(tType.has(type.itemType)
                        ? tType(type.itemType)
                        : type.itemType.replace('_', ' ')
                      ).toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {type.itemCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {formatCurrency(type.typeValue || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderLowStockReport = () => {
    if (!reportData || !Array.isArray(reportData)) return null

    return (
      <div className="bg-background rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t('colItemCode')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t('colItemName')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t('colCurrentStock')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t('colMinimumStock')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t('colUrgency')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t('colSuggestedOrder')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  {t('colSupplier')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {reportData.map((item: any) => (
                <tr key={item.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                    {item.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {item.currentStock} {item.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {item.minimumStock} {item.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        item.urgency === 'out_of_stock'
                          ? 'bg-red-100 text-red-800'
                          : item.urgency === 'critical'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {urgencyLabel(item.urgency)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {item.suggestedOrderQuantity} {item.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {item.supplierName || '-'}
                    {item.supplierPhone && (
                      <div className="text-xs text-muted-foreground">{item.supplierPhone}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderExpiringReport = () => {
    if (!reportData) return null

    return (
      <div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">{t('expiredBatches')}</h3>
            <p className="text-3xl font-bold mt-2 text-red-600">
              {reportData.summary.expiredBatches || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('valueColon', { value: formatCurrency(reportData.summary.expiredValue || 0) })}
            </p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">{t('expiringSoon')}</h3>
            <p className="text-3xl font-bold mt-2 text-orange-600">
              {reportData.summary.expiringSoonBatches || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t('valueColon', {
                value: formatCurrency(reportData.summary.expiringSoonValue || 0),
              })}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-background rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colItem')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colBatchNumber')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colExpiryDate')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colDaysToExpiry')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colQuantity')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colValueAtRisk')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colStatus')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {reportData.items.map((item: any, index: number) => (
                  <tr key={index} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {item.name}
                      <br />
                      <span className="text-xs text-muted-foreground">{item.sku}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {item.batchNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {fmt.formatDate(item.expiryDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {t('daysOption', { days: item.daysToExpiry })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.remainingQty} {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {formatCurrency(item.valueAtRisk || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          item.urgency === 'expired'
                            ? 'bg-red-100 text-red-800'
                            : item.urgency === 'critical'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {urgencyLabel(item.urgency)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderStockValuationReport = () => {
    if (!reportData) return null

    return (
      <div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t('totalStockValueTitle')}
            </h3>
            <p className="text-3xl font-bold mt-2 text-green-600">
              {formatCurrency(reportData.totals.totalValue || 0)}
            </p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">{t('itemsInStock')}</h3>
            <p className="text-3xl font-bold mt-2">{reportData.totals.itemsInStock || 0}</p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">{t('avgItemValue')}</h3>
            <p className="text-3xl font-bold mt-2">
              {formatCurrency(reportData.totals.averageItemValue || 0)}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-background rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colItemCode')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colItemName')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colCategory')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colStock')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colUnitPrice')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    {t('colStockValue')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {reportData.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {item.sku}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {item.categoryName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.currentStock} {item.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {formatCurrency(item.purchasePrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {formatCurrency(item.stockValue || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <Link
          href="/inventory"
          className="px-4 py-2 bg-muted-foreground text-background rounded-lg hover:bg-muted-foreground/80"
        >
          {t('backToInventory')}
        </Link>
      </div>

      {/* Report Tabs */}
      <div className="bg-background rounded-lg shadow mb-6">
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'summary', label: t('tabSummary') },
              { id: 'low_stock', label: t('tabLowStock') },
              { id: 'expiring', label: t('tabExpiring') },
              { id: 'stock_valuation', label: t('tabStockValuation') },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeReport === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Report Parameters */}
        {activeReport === 'expiring' && (
          <div className="p-6 bg-muted/50">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('daysAhead')}
            </label>
            <select
              value={reportParams.days}
              onChange={(e) => setReportParams({ ...reportParams, days: parseInt(e.target.value) })}
              className="px-4 py-2 border border-border rounded-lg"
            >
              <option value="7">{t('daysOption', { days: 7 })}</option>
              <option value="15">{t('daysOption', { days: 15 })}</option>
              <option value="30">{t('daysOption', { days: 30 })}</option>
              <option value="60">{t('daysOption', { days: 60 })}</option>
              <option value="90">{t('daysOption', { days: 90 })}</option>
            </select>
          </div>
        )}
      </div>

      {/* Report Content */}
      <div className="mt-6">
        {loading ? (
          <div className="bg-background rounded-lg shadow p-8 text-center">{t('loading')}</div>
        ) : (
          <>
            {activeReport === 'summary' && renderSummaryReport()}
            {activeReport === 'low_stock' && renderLowStockReport()}
            {activeReport === 'expiring' && renderExpiringReport()}
            {activeReport === 'stock_valuation' && renderStockValuationReport()}
          </>
        )}
      </div>
    </div>
  )
}
