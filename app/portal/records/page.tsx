"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ClipboardList,
  FileText,
  Grid3x3,
  User,
  Calendar,
} from "lucide-react"

export default function PatientRecords() {
  const [tab, setTab] = useState("treatments")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/patient-portal/records?tab=${tab}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tab])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })

  const statusColors: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    PLANNED: "bg-yellow-100 text-yellow-700",
    CANCELLED: "bg-red-100 text-red-700",
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Medical Records</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="treatments">Treatments</TabsTrigger>
          <TabsTrigger value="chart">Dental Chart</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="treatments" className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : !data?.treatments?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No treatment records</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.treatments.map((t: any) => (
                <Card key={t.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{t.procedure.name}</p>
                        {t.procedure.code && (
                          <p className="text-xs text-muted-foreground">Code: {t.procedure.code}</p>
                        )}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Dr. {t.doctor.firstName} {t.doctor.lastName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(t.createdAt)}
                          </span>
                        </div>
                      </div>
                      <Badge className={statusColors[t.status] || "bg-muted text-foreground"}>
                        {t.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chart" className="mt-4">
          {loading ? (
            <Skeleton className="h-64" />
          ) : !data?.chartEntries?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Grid3x3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No dental chart entries</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.chartEntries.map((entry: any) => (
                <Card key={entry.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Tooth #{entry.toothNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.condition} {entry.surface && `(${entry.surface})`}
                        </p>
                      </div>
                      {entry.status && <Badge variant="outline">{entry.status}</Badge>}
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !data?.documents?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No documents uploaded</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.documents.map((doc: any) => (
                <Card key={doc.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.originalName || doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.documentType} &middot; {formatDate(doc.createdAt)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">{doc.fileType}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
