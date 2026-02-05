"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface DentalChartEntry {
  id: string
  toothNumber: number
  toothNotation: string
  condition: string
  severity: string
  mesial: boolean
  distal: boolean
  occlusal: boolean
  buccal: boolean
  lingual: boolean
  notes?: string
  diagnosedDate: string
  resolvedDate?: string
}

interface DentalChartProps {
  patientId: string
}

const TOOTH_CONDITIONS = [
  { value: 'HEALTHY', label: 'Healthy', color: 'bg-green-500' },
  { value: 'CARIES', label: 'Caries', color: 'bg-red-500' },
  { value: 'FILLED', label: 'Filled', color: 'bg-blue-500' },
  { value: 'CROWN', label: 'Crown', color: 'bg-yellow-500' },
  { value: 'BRIDGE', label: 'Bridge', color: 'bg-orange-500' },
  { value: 'IMPLANT', label: 'Implant', color: 'bg-purple-500' },
  { value: 'ROOT_CANAL', label: 'Root Canal', color: 'bg-pink-500' },
  { value: 'EXTRACTION', label: 'Extraction', color: 'bg-gray-700' },
  { value: 'MISSING', label: 'Missing', color: 'bg-gray-400' },
  { value: 'FRACTURED', label: 'Fractured', color: 'bg-amber-600' },
  { value: 'SENSITIVE', label: 'Sensitive', color: 'bg-cyan-500' },
  { value: 'MOBILITY', label: 'Mobility', color: 'bg-indigo-500' },
]

const SEVERITY_LEVELS = [
  { value: 'MILD', label: 'Mild' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'SEVERE', label: 'Severe' },
]

// FDI notation tooth positions
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]

const TOOTH_NAMES: Record<number, string> = {
  // Upper right
  18: 'Third Molar', 17: 'Second Molar', 16: 'First Molar', 15: 'Second Premolar',
  14: 'First Premolar', 13: 'Canine', 12: 'Lateral Incisor', 11: 'Central Incisor',
  // Upper left
  21: 'Central Incisor', 22: 'Lateral Incisor', 23: 'Canine', 24: 'First Premolar',
  25: 'Second Premolar', 26: 'First Molar', 27: 'Second Molar', 28: 'Third Molar',
  // Lower left
  31: 'Central Incisor', 32: 'Lateral Incisor', 33: 'Canine', 34: 'First Premolar',
  35: 'Second Premolar', 36: 'First Molar', 37: 'Second Molar', 38: 'Third Molar',
  // Lower right
  41: 'Central Incisor', 42: 'Lateral Incisor', 43: 'Canine', 44: 'First Premolar',
  45: 'Second Premolar', 46: 'First Molar', 47: 'Second Molar', 48: 'Third Molar',
}

function getConditionColor(condition: string): string {
  const found = TOOTH_CONDITIONS.find(c => c.value === condition)
  return found?.color || 'bg-gray-300'
}

function getConditionLabel(condition: string): string {
  const found = TOOTH_CONDITIONS.find(c => c.value === condition)
  return found?.label || condition
}

interface ToothProps {
  number: number
  entries: DentalChartEntry[]
  onClick: (toothNumber: number) => void
  isUpper: boolean
}

function Tooth({ number, entries, onClick, isUpper }: ToothProps) {
  const activeEntry = entries.find(e => !e.resolvedDate)
  const condition = activeEntry?.condition || 'HEALTHY'
  const isMissing = condition === 'MISSING' || condition === 'EXTRACTION'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onClick(number)}
            className={`relative w-10 h-14 rounded-lg border-2 transition-all hover:scale-110 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary ${
              isMissing ? 'opacity-40 border-dashed' : 'border-gray-300'
            }`}
          >
            {/* Tooth body */}
            <div className={`absolute inset-1 rounded ${getConditionColor(condition)} transition-colors`}>
              {/* Crown area indicator */}
              {!isMissing && (
                <div className={`absolute ${isUpper ? 'bottom-1' : 'top-1'} left-1 right-1 h-2 rounded bg-white/30`} />
              )}
            </div>
            {/* Tooth number */}
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-sm">
              {number}
            </span>
            {/* Surface indicators */}
            {activeEntry && (activeEntry.mesial || activeEntry.distal || activeEntry.occlusal || activeEntry.buccal || activeEntry.lingual) && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-white" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-semibold">{number} - {TOOTH_NAMES[number]}</p>
            <p className={`${isMissing ? 'text-gray-500' : ''}`}>
              {getConditionLabel(condition)}
              {activeEntry?.severity && activeEntry.severity !== 'MILD' && ` (${activeEntry.severity})`}
            </p>
            {activeEntry?.notes && (
              <p className="text-gray-400 text-xs mt-1">{activeEntry.notes}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function DentalChart({ patientId }: DentalChartProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [chartData, setChartData] = useState<Record<number, DentalChartEntry[]>>({})
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form state for new entry
  const [formCondition, setFormCondition] = useState('CARIES')
  const [formSeverity, setFormSeverity] = useState('MILD')
  const [formNotes, setFormNotes] = useState('')
  const [formSurfaces, setFormSurfaces] = useState({
    mesial: false,
    distal: false,
    occlusal: false,
    buccal: false,
    lingual: false,
  })

  const fetchChartData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/dental-chart?patientId=${patientId}&isActive=true`)
      if (!response.ok) throw new Error("Failed to fetch dental chart")

      const data = await response.json()
      setChartData(data.chartData || {})
    } catch (error) {
      console.error("Error fetching dental chart:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load dental chart",
      })
    } finally {
      setLoading(false)
    }
  }, [patientId, toast])

  useEffect(() => {
    fetchChartData()
  }, [fetchChartData])

  const handleToothClick = (toothNumber: number) => {
    setSelectedTooth(toothNumber)
    const entries = chartData[toothNumber] || []
    const activeEntry = entries.find(e => !e.resolvedDate)

    if (activeEntry) {
      setFormCondition(activeEntry.condition)
      setFormSeverity(activeEntry.severity)
      setFormNotes(activeEntry.notes || '')
      setFormSurfaces({
        mesial: activeEntry.mesial,
        distal: activeEntry.distal,
        occlusal: activeEntry.occlusal,
        buccal: activeEntry.buccal,
        lingual: activeEntry.lingual,
      })
    } else {
      setFormCondition('CARIES')
      setFormSeverity('MILD')
      setFormNotes('')
      setFormSurfaces({
        mesial: false,
        distal: false,
        occlusal: false,
        buccal: false,
        lingual: false,
      })
    }

    setDialogOpen(true)
  }

  const handleSaveEntry = async () => {
    if (!selectedTooth) return

    try {
      setSaving(true)

      const response = await fetch('/api/dental-chart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          toothNumber: selectedTooth,
          condition: formCondition,
          severity: formSeverity,
          notes: formNotes || undefined,
          ...formSurfaces,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save entry")
      }

      toast({
        title: "Success",
        description: `Tooth ${selectedTooth} updated successfully`,
      })

      setDialogOpen(false)
      fetchChartData()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save entry",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interactive Dental Chart</CardTitle>
        <CardDescription>
          Click on a tooth to view or update its condition. FDI notation is used.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TOOTH_CONDITIONS.map(condition => (
            <div key={condition.value} className="flex items-center gap-1 text-xs">
              <div className={`w-3 h-3 rounded ${condition.color}`} />
              <span>{condition.label}</span>
            </div>
          ))}
        </div>

        {/* Dental Chart Grid */}
        <div className="relative bg-gradient-to-b from-pink-50 to-pink-100 dark:from-pink-950/20 dark:to-pink-900/20 rounded-xl p-6">
          {/* Upper jaw label */}
          <div className="text-center mb-2 text-sm font-medium text-muted-foreground">
            Upper Jaw (Maxilla)
          </div>

          {/* Upper teeth row */}
          <div className="flex justify-center gap-1 mb-4">
            <div className="flex gap-1">
              {UPPER_RIGHT.map(num => (
                <Tooth
                  key={num}
                  number={num}
                  entries={chartData[num] || []}
                  onClick={handleToothClick}
                  isUpper={true}
                />
              ))}
            </div>
            <div className="w-4" /> {/* Center gap */}
            <div className="flex gap-1">
              {UPPER_LEFT.map(num => (
                <Tooth
                  key={num}
                  number={num}
                  entries={chartData[num] || []}
                  onClick={handleToothClick}
                  isUpper={true}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-dashed border-gray-300 my-4 relative">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-pink-100 dark:bg-pink-900/20 px-2 text-xs text-muted-foreground">
              Midline
            </span>
          </div>

          {/* Lower teeth row */}
          <div className="flex justify-center gap-1 mt-4">
            <div className="flex gap-1">
              {LOWER_RIGHT.map(num => (
                <Tooth
                  key={num}
                  number={num}
                  entries={chartData[num] || []}
                  onClick={handleToothClick}
                  isUpper={false}
                />
              ))}
            </div>
            <div className="w-4" /> {/* Center gap */}
            <div className="flex gap-1">
              {LOWER_LEFT.map(num => (
                <Tooth
                  key={num}
                  number={num}
                  entries={chartData[num] || []}
                  onClick={handleToothClick}
                  isUpper={false}
                />
              ))}
            </div>
          </div>

          {/* Lower jaw label */}
          <div className="text-center mt-2 text-sm font-medium text-muted-foreground">
            Lower Jaw (Mandible)
          </div>

          {/* Quadrant labels */}
          <div className="absolute top-2 left-2 text-xs text-muted-foreground">Q1 (UR)</div>
          <div className="absolute top-2 right-2 text-xs text-muted-foreground">Q2 (UL)</div>
          <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">Q4 (LR)</div>
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">Q3 (LL)</div>
        </div>

        {/* Summary section */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {32 - Object.values(chartData).flat().filter(e => !e.resolvedDate && (e.condition === 'MISSING' || e.condition === 'EXTRACTION')).length}
              </div>
              <div className="text-sm text-muted-foreground">Present Teeth</div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">
                {Object.values(chartData).flat().filter(e => !e.resolvedDate && e.condition === 'CARIES').length}
              </div>
              <div className="text-sm text-muted-foreground">Caries</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">
                {Object.values(chartData).flat().filter(e => !e.resolvedDate && e.condition === 'FILLED').length}
              </div>
              <div className="text-sm text-muted-foreground">Filled</div>
            </CardContent>
          </Card>
          <Card className="bg-gray-50 dark:bg-gray-950/20">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-gray-600">
                {Object.values(chartData).flat().filter(e => !e.resolvedDate && (e.condition === 'MISSING' || e.condition === 'EXTRACTION')).length}
              </div>
              <div className="text-sm text-muted-foreground">Missing</div>
            </CardContent>
          </Card>
        </div>

        {/* Tooth Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Tooth {selectedTooth} - {selectedTooth ? TOOTH_NAMES[selectedTooth] : ''}
              </DialogTitle>
              <DialogDescription>
                View or update the condition of this tooth
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Condition */}
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={formCondition} onValueChange={setFormCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOOTH_CONDITIONS.map(condition => (
                      <SelectItem key={condition.value} value={condition.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${condition.color}`} />
                          {condition.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={formSeverity} onValueChange={setFormSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Surfaces affected */}
              <div className="space-y-2">
                <Label>Surfaces Affected</Label>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(formSurfaces).map(([surface, checked]) => (
                    <div key={surface} className="flex items-center gap-2">
                      <Checkbox
                        id={surface}
                        checked={checked}
                        onCheckedChange={(value) =>
                          setFormSurfaces(prev => ({ ...prev, [surface]: !!value }))
                        }
                      />
                      <label htmlFor={surface} className="text-sm capitalize">
                        {surface}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Add any additional notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              {/* History */}
              {selectedTooth && chartData[selectedTooth]?.length > 0 && (
                <div className="space-y-2">
                  <Label>History</Label>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {chartData[selectedTooth].map((entry, i) => (
                      <div
                        key={entry.id}
                        className={`text-sm p-2 rounded ${entry.resolvedDate ? 'bg-gray-100 dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-950/20'}`}
                      >
                        <div className="flex justify-between">
                          <Badge variant={entry.resolvedDate ? 'outline' : 'default'}>
                            {getConditionLabel(entry.condition)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.diagnosedDate), 'PP')}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEntry} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
