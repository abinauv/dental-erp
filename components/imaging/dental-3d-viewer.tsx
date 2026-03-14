"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Eye,
  Maximize2,
  Minimize2,
} from "lucide-react"

// FDI tooth numbering system — 4 quadrants, 8 teeth each
const QUADRANTS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft: [38, 37, 36, 35, 34, 33, 32, 31],
  lowerRight: [41, 42, 43, 44, 45, 46, 47, 48],
}

const TOOTH_NAMES: Record<number, string> = {
  11: "Upper Right Central Incisor", 12: "Upper Right Lateral Incisor",
  13: "Upper Right Canine", 14: "Upper Right First Premolar",
  15: "Upper Right Second Premolar", 16: "Upper Right First Molar",
  17: "Upper Right Second Molar", 18: "Upper Right Third Molar",
  21: "Upper Left Central Incisor", 22: "Upper Left Lateral Incisor",
  23: "Upper Left Canine", 24: "Upper Left First Premolar",
  25: "Upper Left Second Premolar", 26: "Upper Left First Molar",
  27: "Upper Left Second Molar", 28: "Upper Left Third Molar",
  31: "Lower Left Central Incisor", 32: "Lower Left Lateral Incisor",
  33: "Lower Left Canine", 34: "Lower Left First Premolar",
  35: "Lower Left Second Premolar", 36: "Lower Left First Molar",
  37: "Lower Left Second Molar", 38: "Lower Left Third Molar",
  41: "Lower Right Central Incisor", 42: "Lower Right Lateral Incisor",
  43: "Lower Right Canine", 44: "Lower Right First Premolar",
  45: "Lower Right Second Premolar", 46: "Lower Right First Molar",
  47: "Lower Right Second Molar", 48: "Lower Right Third Molar",
}

const CONDITION_COLORS: Record<string, string> = {
  HEALTHY: "#22c55e",
  CARIES: "#ef4444",
  FILLED: "#3b82f6",
  CROWN: "#a855f7",
  BRIDGE: "#8b5cf6",
  IMPLANT: "#06b6d4",
  ROOT_CANAL: "#f97316",
  EXTRACTION: "#64748b",
  MISSING: "#d1d5db",
  FRACTURED: "#dc2626",
  SENSITIVE: "#eab308",
  MOBILITY: "#f59e0b",
  ABSCESS: "#be123c",
  PERIODONTAL: "#b91c1c",
}

const CONDITION_LABELS: Record<string, string> = {
  HEALTHY: "Healthy", CARIES: "Caries", FILLED: "Filled",
  CROWN: "Crown", BRIDGE: "Bridge", IMPLANT: "Implant",
  ROOT_CANAL: "Root Canal", EXTRACTION: "Extraction",
  MISSING: "Missing", FRACTURED: "Fractured", SENSITIVE: "Sensitive",
  MOBILITY: "Mobility", ABSCESS: "Abscess", PERIODONTAL: "Periodontal",
}

interface ToothData {
  toothNumber: number
  condition: string
  severity?: string
  notes?: string
  surfaces?: { mesial: boolean; distal: boolean; occlusal: boolean; buccal: boolean; lingual: boolean }
  treatments?: { name: string; date: string; status: string }[]
}

interface Dental3DViewerProps {
  patientId: string
  chartData?: ToothData[]
  readOnly?: boolean
  onToothClick?: (toothNumber: number) => void
}

function getToothType(num: number): "molar" | "premolar" | "canine" | "incisor" {
  const pos = num % 10
  if (pos >= 6) return "molar"
  if (pos >= 4) return "premolar"
  if (pos === 3) return "canine"
  return "incisor"
}

function getToothDimensions(type: string) {
  switch (type) {
    case "molar": return { w: 36, h: 32 }
    case "premolar": return { w: 28, h: 26 }
    case "canine": return { w: 24, h: 28 }
    default: return { w: 22, h: 24 }
  }
}

// 3D-ish tooth SVG path generator with gradient fill
function ToothShape({
  x, y, toothNum, condition, isUpper, isSelected, onClick, zoom,
}: {
  x: number; y: number; toothNum: number; condition: string
  isUpper: boolean; isSelected: boolean; onClick: () => void; zoom: number
}) {
  const type = getToothType(toothNum)
  const { w, h } = getToothDimensions(type)
  const fill = CONDITION_COLORS[condition] || CONDITION_COLORS.HEALTHY
  const isMissing = condition === "MISSING" || condition === "EXTRACTION"
  const gradId = `grad-${toothNum}`

  // Root path (extend below/above the crown)
  const rootH = h * 0.6
  const rootPath = isUpper
    ? `M${x + w * 0.3},${y + h} L${x + w * 0.35},${y + h + rootH} Q${x + w * 0.5},${y + h + rootH + 4} ${x + w * 0.65},${y + h + rootH} L${x + w * 0.7},${y + h}`
    : `M${x + w * 0.3},${y} L${x + w * 0.35},${y - rootH} Q${x + w * 0.5},${y - rootH - 4} ${x + w * 0.65},${y - rootH} L${x + w * 0.7},${y}`

  // Crown shape varies by type
  let crownPath: string
  if (type === "molar") {
    crownPath = isUpper
      ? `M${x + 2},${y + h} Q${x},${y + h * 0.5} ${x + 3},${y + 3} Q${x + w * 0.25},${y} ${x + w * 0.5},${y + 1} Q${x + w * 0.75},${y} ${x + w - 3},${y + 3} Q${x + w},${y + h * 0.5} ${x + w - 2},${y + h} Z`
      : `M${x + 2},${y} Q${x},${y + h * 0.5} ${x + 3},${y + h - 3} Q${x + w * 0.25},${y + h} ${x + w * 0.5},${y + h - 1} Q${x + w * 0.75},${y + h} ${x + w - 3},${y + h - 3} Q${x + w},${y + h * 0.5} ${x + w - 2},${y} Z`
  } else if (type === "premolar") {
    crownPath = isUpper
      ? `M${x + 3},${y + h} Q${x + 1},${y + h * 0.4} ${x + 4},${y + 2} Q${x + w * 0.5},${y - 1} ${x + w - 4},${y + 2} Q${x + w - 1},${y + h * 0.4} ${x + w - 3},${y + h} Z`
      : `M${x + 3},${y} Q${x + 1},${y + h * 0.6} ${x + 4},${y + h - 2} Q${x + w * 0.5},${y + h + 1} ${x + w - 4},${y + h - 2} Q${x + w - 1},${y + h * 0.6} ${x + w - 3},${y} Z`
  } else if (type === "canine") {
    crownPath = isUpper
      ? `M${x + 3},${y + h} Q${x + 1},${y + h * 0.4} ${x + 5},${y + 3} Q${x + w * 0.5},${y - 2} ${x + w - 5},${y + 3} Q${x + w - 1},${y + h * 0.4} ${x + w - 3},${y + h} Z`
      : `M${x + 3},${y} Q${x + 1},${y + h * 0.6} ${x + 5},${y + h - 3} Q${x + w * 0.5},${y + h + 2} ${x + w - 5},${y + h - 3} Q${x + w - 1},${y + h * 0.6} ${x + w - 3},${y} Z`
  } else {
    crownPath = isUpper
      ? `M${x + 4},${y + h} Q${x + 2},${y + h * 0.3} ${x + 5},${y + 2} Q${x + w * 0.5},${y - 1} ${x + w - 5},${y + 2} Q${x + w - 2},${y + h * 0.3} ${x + w - 4},${y + h} Z`
      : `M${x + 4},${y} Q${x + 2},${y + h * 0.7} ${x + 5},${y + h - 2} Q${x + w * 0.5},${y + h + 1} ${x + w - 5},${y + h - 2} Q${x + w - 2},${y + h * 0.7} ${x + w - 4},${y} Z`
  }

  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      className="transition-all duration-150"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isMissing ? "#e5e7eb" : fill} stopOpacity={0.9} />
          <stop offset="100%" stopColor={isMissing ? "#d1d5db" : fill} stopOpacity={0.5} />
        </linearGradient>
      </defs>

      {/* Root */}
      <path
        d={rootPath}
        fill={isMissing ? "#e5e7eb" : "#fde68a"}
        stroke="#a8a29e"
        strokeWidth={0.7}
        opacity={isMissing ? 0.3 : 0.7}
      />

      {/* Crown */}
      <path
        d={crownPath}
        fill={`url(#${gradId})`}
        stroke={isSelected ? "#2563eb" : "#374151"}
        strokeWidth={isSelected ? 1.8 : 0.8}
        opacity={isMissing ? 0.3 : 1}
      />

      {/* Selection highlight ring */}
      {isSelected && (
        <circle
          cx={x + w / 2}
          cy={y + h / 2}
          r={Math.max(w, h) * 0.6}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.2}
          strokeDasharray="3,2"
          opacity={0.7}
        />
      )}

      {/* Occlusal surface indicator for conditions */}
      {condition === "CROWN" && (
        <circle cx={x + w / 2} cy={y + h / 2} r={4} fill="#a855f7" stroke="#fff" strokeWidth={0.5} />
      )}
      {condition === "ROOT_CANAL" && (
        <circle cx={x + w / 2} cy={y + h / 2} r={3} fill="none" stroke="#f97316" strokeWidth={1.2} />
      )}
      {condition === "IMPLANT" && (
        <line x1={x + w * 0.3} y1={y + h * 0.3} x2={x + w * 0.7} y2={y + h * 0.7} stroke="#06b6d4" strokeWidth={1.5} />
      )}
      {isMissing && (
        <>
          <line x1={x + w * 0.2} y1={y + h * 0.2} x2={x + w * 0.8} y2={y + h * 0.8} stroke="#64748b" strokeWidth={1.5} />
          <line x1={x + w * 0.8} y1={y + h * 0.2} x2={x + w * 0.2} y2={y + h * 0.8} stroke="#64748b" strokeWidth={1.5} />
        </>
      )}

      {/* Tooth number label */}
      <text
        x={x + w / 2}
        y={isUpper ? y + h + rootH + 14 : y - rootH - 6}
        textAnchor="middle"
        fontSize={8 / zoom}
        fill="#6b7280"
        fontWeight={isSelected ? 600 : 400}
      >
        {toothNum}
      </text>
    </g>
  )
}

export default function Dental3DViewer({
  patientId,
  chartData = [],
  readOnly = false,
  onToothClick,
}: Dental3DViewerProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [viewAngle, setViewAngle] = useState<"front" | "upper" | "lower">("front")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const toothDataMap = new Map<number, ToothData>()
  chartData.forEach((t) => toothDataMap.set(t.toothNumber, t))

  const getCondition = useCallback((num: number) => {
    return toothDataMap.get(num)?.condition || "HEALTHY"
  }, [toothDataMap])

  const handleToothClick = useCallback((num: number) => {
    setSelectedTooth((prev) => (prev === num ? null : num))
    onToothClick?.(num)
  }, [onToothClick])

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5))
  const handleReset = () => { setZoom(1); setSelectedTooth(null); setViewAngle("front") }

  const toggleFullscreen = () => {
    if (!isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
    setIsFullscreen(!isFullscreen)
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  const selectedData = selectedTooth ? toothDataMap.get(selectedTooth) : null

  // Layout calculations
  const svgW = 620
  const svgH = viewAngle === "front" ? 340 : 200
  const archCenterX = svgW / 2
  const archCenterY = svgH / 2

  // Build arch positions — teeth arranged in a U-shape
  function getArchPositions(teeth: number[], isUpper: boolean, side: "left" | "right") {
    const positions: { num: number; x: number; y: number }[] = []
    const startAngle = side === "right" ? Math.PI : 0
    const endAngle = side === "right" ? Math.PI / 2 : Math.PI / 2
    const radiusX = 250
    const radiusY = isUpper ? 110 : 110
    const centerY = isUpper ? archCenterY - 30 : archCenterY + 30

    teeth.forEach((num, i) => {
      const t = i / (teeth.length - 1)
      const angle = side === "right"
        ? startAngle - t * (startAngle - endAngle)
        : endAngle + t * (endAngle) // from π/2 to π for left, 0 to π/2 for right
      const actualAngle = side === "left"
        ? Math.PI / 2 - t * Math.PI / 2
        : Math.PI / 2 + t * Math.PI / 2

      const xPos = archCenterX + radiusX * Math.cos(actualAngle)
      const yBase = centerY + (isUpper ? -1 : 1) * radiusY * Math.sin(actualAngle) * 0.4

      positions.push({ num, x: xPos - 14, y: yBase - 14 })
    })
    return positions
  }

  const upperRightPos = getArchPositions(QUADRANTS.upperRight, true, "right")
  const upperLeftPos = getArchPositions(QUADRANTS.upperLeft, true, "left")
  const lowerLeftPos = getArchPositions(QUADRANTS.lowerLeft, false, "left")
  const lowerRightPos = getArchPositions(QUADRANTS.lowerRight, false, "right")

  const allPositions = [
    ...upperRightPos.map((p) => ({ ...p, isUpper: true })),
    ...upperLeftPos.map((p) => ({ ...p, isUpper: true })),
    ...lowerLeftPos.map((p) => ({ ...p, isUpper: false })),
    ...lowerRightPos.map((p) => ({ ...p, isUpper: false })),
  ]

  const filteredPositions = viewAngle === "upper"
    ? allPositions.filter((p) => p.isUpper)
    : viewAngle === "lower"
    ? allPositions.filter((p) => !p.isUpper)
    : allPositions

  // Stats
  const conditionCounts: Record<string, number> = {}
  chartData.forEach((t) => {
    conditionCounts[t.condition] = (conditionCounts[t.condition] || 0) + 1
  })
  const presentTeeth = 32 - (conditionCounts["MISSING"] || 0) - (conditionCounts["EXTRACTION"] || 0)

  return (
    <div ref={containerRef} className={isFullscreen ? "bg-background p-4" : ""}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Interactive Dental Viewer</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant={viewAngle === "front" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewAngle("front")}
                  className="rounded-none h-8"
                >
                  Full
                </Button>
                <Button
                  variant={viewAngle === "upper" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewAngle("upper")}
                  className="rounded-none h-8"
                >
                  Upper
                </Button>
                <Button
                  variant={viewAngle === "lower" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewAngle("lower")}
                  className="rounded-none h-8"
                >
                  Lower
                </Button>
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {/* Main SVG viewer */}
            <div className="flex-1 border rounded-lg bg-muted/50 overflow-hidden">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
              >
                {/* Jaw arch guidelines */}
                {viewAngle !== "lower" && (
                  <ellipse
                    cx={archCenterX}
                    cy={archCenterY - 30}
                    rx={240}
                    ry={70}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                )}
                {viewAngle !== "upper" && (
                  <ellipse
                    cx={archCenterX}
                    cy={archCenterY + 30}
                    rx={240}
                    ry={70}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                )}

                {/* Labels */}
                {viewAngle !== "lower" && (
                  <text x={archCenterX} y={12} textAnchor="middle" fontSize={10} fill="#9ca3af" fontWeight={500}>
                    Maxillary (Upper)
                  </text>
                )}
                {viewAngle !== "upper" && (
                  <text x={archCenterX} y={svgH - 4} textAnchor="middle" fontSize={10} fill="#9ca3af" fontWeight={500}>
                    Mandibular (Lower)
                  </text>
                )}

                <text x={8} y={svgH / 2 + 3} fontSize={9} fill="#9ca3af">R</text>
                <text x={svgW - 14} y={svgH / 2 + 3} fontSize={9} fill="#9ca3af">L</text>

                {/* Teeth */}
                {filteredPositions.map((pos) => (
                  <ToothShape
                    key={pos.num}
                    x={pos.x}
                    y={pos.y}
                    toothNum={pos.num}
                    condition={getCondition(pos.num)}
                    isUpper={pos.isUpper}
                    isSelected={selectedTooth === pos.num}
                    onClick={() => handleToothClick(pos.num)}
                    zoom={zoom}
                  />
                ))}
              </svg>
            </div>

            {/* Info panel */}
            <div className="w-64 space-y-3">
              {/* Selected tooth details */}
              {selectedTooth && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-3">
                    <p className="font-semibold text-sm">Tooth #{selectedTooth}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {TOOTH_NAMES[selectedTooth]}
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{ backgroundColor: CONDITION_COLORS[getCondition(selectedTooth)] }}
                        />
                        <span className="text-sm">
                          {CONDITION_LABELS[getCondition(selectedTooth)]}
                        </span>
                      </div>
                      {selectedData?.severity && (
                        <p className="text-xs text-muted-foreground">
                          Severity: {selectedData.severity}
                        </p>
                      )}
                      {selectedData?.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedData.notes}
                        </p>
                      )}
                      {selectedData?.surfaces && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedData.surfaces.mesial && <Badge variant="outline" className="text-[10px] py-0">M</Badge>}
                          {selectedData.surfaces.distal && <Badge variant="outline" className="text-[10px] py-0">D</Badge>}
                          {selectedData.surfaces.occlusal && <Badge variant="outline" className="text-[10px] py-0">O</Badge>}
                          {selectedData.surfaces.buccal && <Badge variant="outline" className="text-[10px] py-0">B</Badge>}
                          {selectedData.surfaces.lingual && <Badge variant="outline" className="text-[10px] py-0">L</Badge>}
                        </div>
                      )}
                      {selectedData?.treatments && selectedData.treatments.length > 0 && (
                        <div className="mt-2 border-t pt-2">
                          <p className="text-xs font-medium mb-1">Treatment History</p>
                          {selectedData.treatments.map((tx, i) => (
                            <div key={i} className="text-xs text-muted-foreground">
                              {tx.name} — {tx.date}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Summary stats */}
              <Card>
                <CardContent className="p-3">
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> Overview
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Present Teeth</span>
                      <span className="font-medium">{presentTeeth}/32</span>
                    </div>
                    {Object.entries(conditionCounts)
                      .filter(([c]) => c !== "HEALTHY")
                      .sort((a, b) => b[1] - a[1])
                      .map(([condition, count]) => (
                        <div key={condition} className="flex justify-between items-center">
                          <div className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: CONDITION_COLORS[condition] }}
                            />
                            <span className="text-muted-foreground">{CONDITION_LABELS[condition]}</span>
                          </div>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Legend */}
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs font-medium mb-2">Legend</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(CONDITION_LABELS).slice(0, 10).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-1">
                        <div
                          className="w-2.5 h-2.5 rounded-sm border"
                          style={{ backgroundColor: CONDITION_COLORS[key] }}
                        />
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
