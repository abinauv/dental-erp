"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Pill,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface Prescription {
  id: string
  prescriptionNo: string
  createdAt: string
  diagnosis: string | null
  notes: string | null
  doctor: {
    firstName: string
    lastName: string
    specialization: string | null
  }
  medications: Array<{
    id: string
    medication: {
      name: string
      genericName: string | null
      form: string | null
      strength: string | null
    } | null
    medicationName: string
    dosage: string
    frequency: string
    duration: string
    instructions: string | null
    quantity: number | null
  }>
}

export default function PatientPrescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/patient-portal/prescriptions")
      .then((r) => r.json())
      .then((data) => setPrescriptions(data.prescriptions || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prescriptions</h1>

      {prescriptions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Pill className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No prescriptions yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((rx) => (
            <Card key={rx.id}>
              <CardContent className="py-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === rx.id ? null : rx.id)}
                >
                  <div className="space-y-1">
                    <p className="font-medium">{rx.prescriptionNo}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Dr. {rx.doctor.firstName} {rx.doctor.lastName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(rx.createdAt)}
                      </span>
                    </div>
                    {rx.diagnosis && (
                      <p className="text-sm text-muted-foreground">
                        Diagnosis: {rx.diagnosis}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{rx.medications.length} meds</Badge>
                    {expandedId === rx.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedId === rx.id && (
                  <div className="mt-4 space-y-3">
                    <Separator />
                    {rx.medications.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {item.medication?.name || item.medicationName}
                            {item.medication?.strength && ` ${item.medication.strength}`}
                          </p>
                          {item.quantity && (
                            <Badge variant="outline" className="text-xs">
                              Qty: {item.quantity}
                            </Badge>
                          )}
                        </div>
                        {item.medication?.genericName && (
                          <p className="text-xs text-muted-foreground">
                            ({item.medication.genericName})
                          </p>
                        )}
                        <p className="text-sm">
                          {item.dosage} &middot; {item.frequency} &middot; {item.duration}
                        </p>
                        {item.instructions && (
                          <p className="text-xs text-muted-foreground italic">
                            {item.instructions}
                          </p>
                        )}
                      </div>
                    ))}
                    {rx.notes && (
                      <>
                        <Separator />
                        <p className="text-sm text-muted-foreground">
                          <strong>Notes:</strong> {rx.notes}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
