'use client'

import { useState, useEffect, useCallback } from 'react'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ClipboardList, Plus, Search, Eye, Trash2, Loader2 } from 'lucide-react'
import { ExportMenu } from '@/components/ui/export-menu'

interface Prescription {
  id: string
  prescriptionNo: string
  diagnosis: string | null
  createdAt: string
  validUntil: string | null
  patient: { id: string; patientId: string; firstName: string; lastName: string }
  doctor: { id: string; name: string }
  medications: { id: string; medicationName: string; dosage: string; frequency: string; duration: string }[]
}

export default function PrescriptionsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 })

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pagination.page), limit: '20' })
      if (search) params.set('search', search)

      const res = await fetch(`/api/prescriptions?${params}`)
      const result = await res.json()
      if (result.success) {
        setPrescriptions(result.data)
        setPagination(prev => ({ ...prev, total: result.pagination.total, pages: result.pagination.pages }))
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load prescriptions' })
    } finally {
      setLoading(false)
    }
  }, [search, pagination.page])

  useEffect(() => { fetchPrescriptions() }, [fetchPrescriptions])

  const handleDelete = async (rx: Prescription) => {
    const ok = await confirm({ title: "Delete Prescription", description: `Delete prescription ${rx.prescriptionNo}?`, confirmLabel: "Delete" })
    if (!ok) return
    try {
      const res = await fetch(`/api/prescriptions/${rx.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Deleted', description: `Prescription ${rx.prescriptionNo} removed` })
      fetchPrescriptions()
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete prescription' })
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-8 w-8" />
            Prescriptions
          </h1>
          <p className="text-muted-foreground">Create and manage patient prescriptions</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            filename="prescriptions"
            getData={() => prescriptions.map(rx => ({
              "Rx #": rx.prescriptionNo,
              "Patient": `${rx.patient.firstName} ${rx.patient.lastName}`,
              "Patient ID": rx.patient.patientId,
              "Doctor": rx.doctor.name,
              "Diagnosis": rx.diagnosis || "",
              "Medications": rx.medications.map(m => `${m.medicationName} ${m.dosage} ${m.frequency} ${m.duration}`).join("; "),
              "Date": new Date(rx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
              "Valid Until": rx.validUntil ? new Date(rx.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "",
            }))}
          />
          <Button onClick={() => router.push('/prescriptions/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Prescription
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by prescription #, patient name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No prescriptions found</p>
              <p className="text-sm">Create your first prescription to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rx #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Doctor</TableHead>
                  <TableHead className="hidden md:table-cell">Diagnosis</TableHead>
                  <TableHead className="hidden lg:table-cell">Medications</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prescriptions.map(rx => (
                  <TableRow key={rx.id}>
                    <TableCell className="font-mono text-sm">{rx.prescriptionNo}</TableCell>
                    <TableCell className="font-medium">
                      {rx.patient.firstName} {rx.patient.lastName}
                      <br />
                      <span className="text-xs text-muted-foreground">{rx.patient.patientId}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{rx.doctor.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{rx.diagnosis || '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {rx.medications.slice(0, 3).map(m => (
                          <Badge key={m.id} variant="outline" className="text-xs">{m.medicationName}</Badge>
                        ))}
                        {rx.medications.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{rx.medications.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {new Date(rx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/prescriptions/${rx.id}`)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(rx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-3">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
            Next
          </Button>
        </div>
      )}
      {ConfirmDialogComponent}
    </div>
  )
}
