"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  toothConditionConfig,
  toothNumbers,
  toothNames,
  toothSurfaceLabels,
  getToothType
} from "@/lib/treatment-utils"

interface DentalChartEntry {
  id: string
  toothNumber: number
  condition: string
  surfaces: string | null
  notes: string | null
  recordedDate: string
  isActive: boolean
  recordedBy?: {
    firstName: string
    lastName: string
  }
}

interface DentalChartProps {
  patientId: string
  entries?: DentalChartEntry[]
  onToothClick?: (toothNumber: number, entries: DentalChartEntry[]) => void
  onEntryCreate?: (data: any) => Promise<void>
  onEntryUpdate?: (id: string, data: any) => Promise<void>
  editable?: boolean
  selectedTeeth?: number[]
  onTeethSelect?: (teeth: number[]) => void
}

const conditions = [
  "HEALTHY",
  "CARIES",
  "FILLED",
  "CROWN",
  "BRIDGE",
  "MISSING",
  "IMPLANT",
  "ROOT_CANAL",
  "EXTRACTION_NEEDED",
  "VENEER"
]

const surfaces = ["M", "D", "O", "B", "L", "I", "F", "P"]

const EMPTY_ENTRIES: DentalChartEntry[] = []
const EMPTY_TEETH: number[] = []

export function DentalChart({
  patientId,
  entries = EMPTY_ENTRIES,
  onToothClick,
  onEntryCreate,
  onEntryUpdate,
  editable = false,
  selectedTeeth = EMPTY_TEETH,
  onTeethSelect,
}: DentalChartProps) {
  const [chartData, setChartData] = useState<Record<number, DentalChartEntry[]>>({})
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"view" | "edit" | "add">("view")
  const [formData, setFormData] = useState({
    condition: "HEALTHY",
    surfaces: [] as string[],
    notes: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Group entries by tooth number
    const grouped: Record<number, DentalChartEntry[]> = {}
    entries.forEach(entry => {
      if (!grouped[entry.toothNumber]) {
        grouped[entry.toothNumber] = []
      }
      grouped[entry.toothNumber].push(entry)
    })
    setChartData(grouped)
  }, [entries])

  const getToothCondition = (toothNumber: number): string => {
    const toothEntries = chartData[toothNumber]
    if (!toothEntries || toothEntries.length === 0) return "HEALTHY"
    // Return the most recent active entry's condition
    const activeEntry = toothEntries.find(e => e.isActive)
    return activeEntry?.condition || "HEALTHY"
  }

  const getToothColor = (toothNumber: number): string => {
    const condition = getToothCondition(toothNumber)
    const config = toothConditionConfig[condition]
    return config?.fillColor || "#22c55e"
  }

  const handleToothClick = (toothNumber: number) => {
    if (onTeethSelect) {
      // Selection mode for treatment
      const isSelected = selectedTeeth.includes(toothNumber)
      if (isSelected) {
        onTeethSelect(selectedTeeth.filter(t => t !== toothNumber))
      } else {
        onTeethSelect([...selectedTeeth, toothNumber])
      }
    } else {
      // View/Edit mode
      setSelectedTooth(toothNumber)
      const toothEntries = chartData[toothNumber] || []

      if (editable) {
        if (toothEntries.length > 0) {
          const latestEntry = toothEntries.find(e => e.isActive) || toothEntries[0]
          setFormData({
            condition: latestEntry.condition,
            surfaces: latestEntry.surfaces ? latestEntry.surfaces.split(",") : [],
            notes: latestEntry.notes || "",
          })
          setDialogMode("edit")
        } else {
          setFormData({
            condition: "HEALTHY",
            surfaces: [],
            notes: "",
          })
          setDialogMode("add")
        }
      } else {
        setDialogMode("view")
      }

      setIsDialogOpen(true)

      if (onToothClick) {
        onToothClick(toothNumber, toothEntries)
      }
    }
  }

  const handleSubmit = async () => {
    if (!selectedTooth) return

    setIsSubmitting(true)
    try {
      const data = {
        patientId,
        toothNumber: selectedTooth,
        condition: formData.condition,
        surfaces: formData.surfaces.length > 0 ? formData.surfaces.join(",") : null,
        notes: formData.notes || null,
      }

      if (dialogMode === "add" && onEntryCreate) {
        await onEntryCreate(data)
      } else if (dialogMode === "edit" && onEntryUpdate) {
        const existingEntry = chartData[selectedTooth]?.find(e => e.isActive)
        if (existingEntry) {
          await onEntryUpdate(existingEntry.id, data)
        }
      }

      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving dental chart entry:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderTooth = (toothNumber: number, position: "upper" | "lower") => {
    const condition = getToothCondition(toothNumber)
    const isSelected = selectedTeeth.includes(toothNumber)
    const hasEntry = chartData[toothNumber]?.some(e => e.isActive)
    const toothType = getToothType(toothNumber)

    // Tooth dimensions based on type
    const dimensions = {
      molar: { width: 32, height: 28 },
      premolar: { width: 26, height: 24 },
      canine: { width: 22, height: 26 },
      incisor: { width: 20, height: 22 },
    }

    const { width, height } = dimensions[toothType]

    return (
      <button
        key={toothNumber}
        onClick={() => handleToothClick(toothNumber)}
        className={`
          relative flex flex-col items-center justify-center
          transition-all duration-200 hover:scale-110
          ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
          ${hasEntry && condition !== "HEALTHY" ? "cursor-pointer" : "cursor-pointer"}
        `}
        title={`${toothNumber}: ${toothNames[toothNumber]}`}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="drop-shadow-sm"
        >
          {/* Tooth shape - simplified representation */}
          {toothType === "molar" ? (
            <path
              d={position === "upper"
                ? `M4,${height-4} Q2,${height/2} 4,4 Q${width/2},0 ${width-4},4 Q${width-2},${height/2} ${width-4},${height-4} Z`
                : `M4,4 Q2,${height/2} 4,${height-4} Q${width/2},${height} ${width-4},${height-4} Q${width-2},${height/2} ${width-4},4 Z`
              }
              fill={getToothColor(toothNumber)}
              stroke="#374151"
              strokeWidth="1.5"
            />
          ) : toothType === "premolar" ? (
            <ellipse
              cx={width/2}
              cy={height/2}
              rx={width/2 - 2}
              ry={height/2 - 2}
              fill={getToothColor(toothNumber)}
              stroke="#374151"
              strokeWidth="1.5"
            />
          ) : (
            <path
              d={position === "upper"
                ? `M${width/2},2 Q${width-2},${height/3} ${width-2},${height-4} Q${width/2},${height} 2,${height-4} Q2,${height/3} ${width/2},2 Z`
                : `M${width/2},${height-2} Q${width-2},${height*2/3} ${width-2},4 Q${width/2},0 2,4 Q2,${height*2/3} ${width/2},${height-2} Z`
              }
              fill={getToothColor(toothNumber)}
              stroke="#374151"
              strokeWidth="1.5"
            />
          )}

          {/* Condition indicator for non-healthy teeth */}
          {condition === "MISSING" && (
            <text
              x={width/2}
              y={height/2 + 4}
              textAnchor="middle"
              fontSize="14"
              fill="#6b7280"
              fontWeight="bold"
            >
              X
            </text>
          )}
          {condition === "ROOT_CANAL" && (
            <circle
              cx={width/2}
              cy={height/2}
              r="4"
              fill="none"
              stroke="#374151"
              strokeWidth="1.5"
            />
          )}
        </svg>

        {/* Tooth number */}
        <span className={`text-xs font-medium mt-1 ${
          position === "upper" ? "order-first mb-1" : ""
        }`}>
          {toothNumber}
        </span>
      </button>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Dental Chart</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(toothConditionConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1 text-xs">
                <div
                  className="w-3 h-3 rounded-full border border-border"
                  style={{ backgroundColor: config.fillColor }}
                />
                <span className="text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-8 py-4">
          {/* Upper Jaw */}
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground mb-2">Upper Jaw</div>
            <div className="flex gap-1 justify-center">
              {/* Upper Right (18-11) */}
              <div className="flex gap-1 border-r-2 border-border pr-2">
                {toothNumbers.upperRight.map(num => renderTooth(num, "upper"))}
              </div>
              {/* Upper Left (21-28) */}
              <div className="flex gap-1 pl-2">
                {toothNumbers.upperLeft.map(num => renderTooth(num, "upper"))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full border-t border-border" />

          {/* Lower Jaw */}
          <div className="text-center">
            <div className="flex gap-1 justify-center">
              {/* Lower Right (48-41) */}
              <div className="flex gap-1 border-r-2 border-border pr-2">
                {toothNumbers.lowerRight.map(num => renderTooth(num, "lower"))}
              </div>
              {/* Lower Left (31-38) */}
              <div className="flex gap-1 pl-2">
                {toothNumbers.lowerLeft.map(num => renderTooth(num, "lower"))}
              </div>
            </div>
            <div className="text-sm font-medium text-muted-foreground mt-2">Lower Jaw</div>
          </div>
        </div>

        {/* Selected teeth display */}
        {selectedTeeth.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-2">Selected Teeth:</div>
            <div className="flex flex-wrap gap-2">
              {selectedTeeth.sort((a, b) => a - b).map(tooth => (
                <Badge key={tooth} variant="secondary">
                  {tooth} - {toothNames[tooth]?.split(" ").slice(-2).join(" ")}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Tooth Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Tooth {selectedTooth} - {selectedTooth && toothNames[selectedTooth]}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "view"
                ? "View tooth condition and history"
                : dialogMode === "add"
                ? "Add new condition record"
                : "Update tooth condition"
              }
            </DialogDescription>
          </DialogHeader>

          {dialogMode === "view" ? (
            <div className="space-y-4">
              {selectedTooth && chartData[selectedTooth]?.length > 0 ? (
                chartData[selectedTooth]
                  .filter(e => e.isActive)
                  .map(entry => (
                    <div key={entry.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={`${toothConditionConfig[entry.condition]?.bgColor} ${toothConditionConfig[entry.condition]?.color}`}>
                          {toothConditionConfig[entry.condition]?.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(entry.recordedDate).toLocaleDateString()}
                        </span>
                      </div>
                      {entry.surfaces && (
                        <div className="text-sm mb-1">
                          <span className="font-medium">Surfaces:</span>{" "}
                          {entry.surfaces.split(",").map(s => toothSurfaceLabels[s] || s).join(", ")}
                        </div>
                      )}
                      {entry.notes && (
                        <div className="text-sm text-muted-foreground">{entry.notes}</div>
                      )}
                      {entry.recordedBy && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Recorded by Dr. {entry.recordedBy.firstName} {entry.recordedBy.lastName}
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No conditions recorded for this tooth
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={formData.condition}
                  onValueChange={(value) => setFormData({ ...formData, condition: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map(condition => (
                      <SelectItem key={condition} value={condition}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: toothConditionConfig[condition]?.fillColor }}
                          />
                          {toothConditionConfig[condition]?.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Affected Surfaces</Label>
                <div className="flex flex-wrap gap-2">
                  {surfaces.map(surface => (
                    <label
                      key={surface}
                      className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={formData.surfaces.includes(surface)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({ ...formData, surfaces: [...formData.surfaces, surface] })
                          } else {
                            setFormData({ ...formData, surfaces: formData.surfaces.filter(s => s !== surface) })
                          }
                        }}
                      />
                      <span className="text-sm">
                        {surface} ({toothSurfaceLabels[surface]})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any observations or notes..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {dialogMode === "view" ? "Close" : "Cancel"}
            </Button>
            {dialogMode !== "view" && (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
