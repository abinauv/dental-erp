'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function InventoryReportsPage() {
  const [activeReport, setActiveReport] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [reportParams, setReportParams] = useState({
    days: 30
  });

  useEffect(() => {
    fetchReport();
  }, [activeReport, reportParams]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: activeReport,
        days: String(reportParams.days),
      });

      const response = await fetch(`/api/inventory/reports?${params}`);
      const data = await response.json();

      if (data.success) {
        setReportData(data.data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const renderSummaryReport = () => {
    if (!reportData) return null;

    return (
      <div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Total Items</h3>
            <p className="text-3xl font-bold mt-2">{reportData.summary.total_items}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {reportData.summary.active_items} active
            </p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Out of Stock</h3>
            <p className="text-3xl font-bold mt-2 text-red-600">
              {reportData.summary.out_of_stock_items}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Items need restock</p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Low Stock</h3>
            <p className="text-3xl font-bold mt-2 text-orange-600">
              {reportData.summary.low_stock_items}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Items below minimum</p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Inventory Value</h3>
            <p className="text-3xl font-bold mt-2 text-green-600">
              {formatCurrency(reportData.summary.total_inventory_value || 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Total stock value</p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-background p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-bold mb-4">Inventory by Category</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Item Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Category Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {reportData.category_breakdown.map((cat: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {cat.category || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {cat.item_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {formatCurrency(cat.category_value || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Type Breakdown */}
        <div className="bg-background p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4">Inventory by Type</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Item Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Type Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {reportData.type_breakdown.map((type: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {type.item_type.replace('_', ' ').toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {type.item_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {formatCurrency(type.type_value || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderLowStockReport = () => {
    if (!reportData || !Array.isArray(reportData)) return null;

    return (
      <div className="bg-background rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Item Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Item Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Minimum Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Urgency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Suggested Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Supplier
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {reportData.map((item: any) => (
                <tr key={item.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                    {item.item_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {item.current_stock} {item.unit_of_measurement}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {item.minimum_stock} {item.unit_of_measurement}
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
                      {item.urgency.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {item.suggested_order_quantity} {item.unit_of_measurement}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {item.supplier_name || '-'}
                    {item.supplier_phone && (
                      <div className="text-xs text-muted-foreground">{item.supplier_phone}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderExpiringReport = () => {
    if (!reportData) return null;

    return (
      <div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Expired Batches</h3>
            <p className="text-3xl font-bold mt-2 text-red-600">
              {reportData.summary.expired_batches || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Value: {formatCurrency(reportData.summary.expired_value || 0)}
            </p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Expiring Soon</h3>
            <p className="text-3xl font-bold mt-2 text-orange-600">
              {reportData.summary.expiring_soon_batches || 0}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Value: {formatCurrency(reportData.summary.expiring_soon_value || 0)}
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
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Batch Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Expiry Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Days to Expiry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Value at Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {reportData.items.map((item: any, index: number) => (
                  <tr key={index} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {item.name}
                      <br />
                      <span className="text-xs text-muted-foreground">{item.item_code}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {item.batch_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {new Date(item.expiry_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.days_to_expiry} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.remaining_quantity} {item.unit_of_measurement}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {formatCurrency(item.value_at_risk || 0)}
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
                        {item.urgency.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderStockValuationReport = () => {
    if (!reportData) return null;

    return (
      <div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Total Stock Value</h3>
            <p className="text-3xl font-bold mt-2 text-green-600">
              {formatCurrency(reportData.totals.total_value || 0)}
            </p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Items in Stock</h3>
            <p className="text-3xl font-bold mt-2">{reportData.totals.items_in_stock || 0}</p>
          </div>

          <div className="bg-background p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-muted-foreground">Average Item Value</h3>
            <p className="text-3xl font-bold mt-2">
              {formatCurrency(reportData.totals.average_item_value || 0)}
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
                    Item Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Item Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Stock Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {reportData.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {item.item_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {item.category_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {item.current_stock} {item.unit_of_measurement}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {formatCurrency(item.stock_value || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Inventory Reports</h1>
        <Link
          href="/inventory"
          className="px-4 py-2 bg-muted-foreground text-background rounded-lg hover:bg-muted-foreground/80"
        >
          Back to Inventory
        </Link>
      </div>

      {/* Report Tabs */}
      <div className="bg-background rounded-lg shadow mb-6">
        <div className="border-b border-border">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'summary', label: 'Summary' },
              { id: 'low_stock', label: 'Low Stock' },
              { id: 'expiring', label: 'Expiring Items' },
              { id: 'stock_valuation', label: 'Stock Valuation' }
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
              Days Ahead
            </label>
            <select
              value={reportParams.days}
              onChange={(e) =>
                setReportParams({ ...reportParams, days: parseInt(e.target.value) })
              }
              className="px-4 py-2 border border-border rounded-lg"
            >
              <option value="7">7 days</option>
              <option value="15">15 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
        )}
      </div>

      {/* Report Content */}
      <div className="mt-6">
        {loading ? (
          <div className="bg-background rounded-lg shadow p-8 text-center">Loading...</div>
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
  );
}
