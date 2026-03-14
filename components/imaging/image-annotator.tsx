"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Pen,
  Minus,
  MoveRight,
  Circle,
  Square,
  Type,
  Undo2,
  Redo2,
  Trash2,
  Save,
  X,
  Palette,
  Loader2,
} from "lucide-react"

export interface Annotation {
  id: string
  type: "freehand" | "line" | "arrow" | "circle" | "rectangle" | "text"
  points: number[] // [x1,y1,x2,y2,...] normalized 0-1
  color: string
  lineWidth: number
  text?: string
}

interface ImageAnnotatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  title?: string
  annotations: Annotation[]
  onSave: (annotations: Annotation[]) => Promise<void>
  readOnly?: boolean
}

const TOOLS = [
  { id: "freehand" as const, label: "Draw", icon: Pen },
  { id: "line" as const, label: "Line", icon: Minus },
  { id: "arrow" as const, label: "Arrow", icon: MoveRight },
  { id: "circle" as const, label: "Circle", icon: Circle },
  { id: "rectangle" as const, label: "Rectangle", icon: Square },
  { id: "text" as const, label: "Text", icon: Type },
]

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ffffff", // white
]

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

export function ImageAnnotator({
  open,
  onOpenChange,
  src,
  title,
  annotations: initialAnnotations,
  onSave,
  readOnly = false,
}: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [tool, setTool] = useState<Annotation["type"]>("freehand")
  const [color, setColor] = useState("#ef4444")
  const [lineWidth, setLineWidth] = useState(3)
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations)
  const [undoStack, setUndoStack] = useState<Annotation[][]>([])
  const [redoStack, setRedoStack] = useState<Annotation[][]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPoints, setCurrentPoints] = useState<number[]>([])
  const [textInput, setTextInput] = useState("")
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })

  // Load image and set canvas size
  useEffect(() => {
    if (!open) return
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      imgRef.current = img
      setImageLoaded(true)
    }
    img.src = src
    return () => {
      imgRef.current = null
      setImageLoaded(false)
    }
  }, [open, src])

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setAnnotations(initialAnnotations)
      setUndoStack([])
      setRedoStack([])
      setTextPosition(null)
    }
  }, [open, initialAnnotations])

  // Size canvases to fit container while maintaining aspect ratio
  useEffect(() => {
    if (!imageLoaded || !imgRef.current || !containerRef.current) return
    const container = containerRef.current
    const img = imgRef.current
    const maxW = container.clientWidth
    const maxH = container.clientHeight
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    const w = Math.round(img.naturalWidth * ratio)
    const h = Math.round(img.naturalHeight * ratio)
    setCanvasSize({ w, h })
  }, [imageLoaded, open])

  // Render image + annotations
  useEffect(() => {
    if (!canvasRef.current || !imgRef.current || canvasSize.w === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = canvasSize.w
    canvas.height = canvasSize.h

    // Draw image
    ctx.drawImage(imgRef.current, 0, 0, canvasSize.w, canvasSize.h)

    // Draw saved annotations
    for (const ann of annotations) {
      drawAnnotation(ctx, ann, canvasSize.w, canvasSize.h)
    }
  }, [annotations, canvasSize, imageLoaded])

  // Render overlay (current drawing in progress)
  useEffect(() => {
    if (!overlayRef.current || canvasSize.w === 0) return
    const canvas = overlayRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = canvasSize.w
    canvas.height = canvasSize.h
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h)

    if (currentPoints.length >= 2) {
      const tempAnnotation: Annotation = {
        id: "temp",
        type: tool,
        points: currentPoints,
        color,
        lineWidth,
      }
      drawAnnotation(ctx, tempAnnotation, canvasSize.w, canvasSize.h)
    }
  }, [currentPoints, tool, color, lineWidth, canvasSize])

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent) => {
      const canvas = overlayRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return {
        x: (e.clientX - rect.left) / canvasSize.w,
        y: (e.clientY - rect.top) / canvasSize.h,
      }
    },
    [canvasSize]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly) return
      const { x, y } = getCanvasCoords(e)

      if (tool === "text") {
        setTextPosition({ x, y })
        return
      }

      setIsDrawing(true)
      setCurrentPoints([x, y])
    },
    [getCanvasCoords, tool, readOnly]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || readOnly) return
      const { x, y } = getCanvasCoords(e)

      if (tool === "freehand") {
        setCurrentPoints((prev) => [...prev, x, y])
      } else {
        // For shapes, only keep start + current point
        setCurrentPoints((prev) => [prev[0], prev[1], x, y])
      }
    },
    [isDrawing, getCanvasCoords, tool, readOnly]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || readOnly) return
    setIsDrawing(false)

    if (currentPoints.length >= 4 || (tool === "freehand" && currentPoints.length >= 2)) {
      const newAnnotation: Annotation = {
        id: generateId(),
        type: tool,
        points: currentPoints,
        color,
        lineWidth,
      }
      setUndoStack((prev) => [...prev, annotations])
      setRedoStack([])
      setAnnotations((prev) => [...prev, newAnnotation])
    }
    setCurrentPoints([])
  }, [isDrawing, currentPoints, tool, color, lineWidth, annotations, readOnly])

  const handleTextSubmit = useCallback(() => {
    if (!textPosition || !textInput.trim()) {
      setTextPosition(null)
      setTextInput("")
      return
    }
    const newAnnotation: Annotation = {
      id: generateId(),
      type: "text",
      points: [textPosition.x, textPosition.y],
      color,
      lineWidth,
      text: textInput.trim(),
    }
    setUndoStack((prev) => [...prev, annotations])
    setRedoStack([])
    setAnnotations((prev) => [...prev, newAnnotation])
    setTextPosition(null)
    setTextInput("")
  }, [textPosition, textInput, color, lineWidth, annotations])

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack((r) => [...r, annotations])
    setAnnotations(prev)
    setUndoStack((u) => u.slice(0, -1))
  }, [undoStack, annotations])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((u) => [...u, annotations])
    setAnnotations(next)
    setRedoStack((r) => r.slice(0, -1))
  }, [redoStack, annotations])

  const handleClearAll = useCallback(() => {
    if (annotations.length === 0) return
    setUndoStack((prev) => [...prev, annotations])
    setRedoStack([])
    setAnnotations([])
  }, [annotations])

  const handleSave = useCallback(async () => {
    try {
      setSaving(true)
      await onSave(annotations)
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false)
    }
  }, [annotations, onSave, onOpenChange])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault()
        handleUndo()
      } else if (e.ctrlKey && e.key === "y") {
        e.preventDefault()
        handleRedo()
      } else if (e.key === "Escape" && textPosition) {
        setTextPosition(null)
        setTextInput("")
      } else if (e.key === "Enter" && textPosition) {
        handleTextSubmit()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, handleUndo, handleRedo, textPosition, handleTextSubmit])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0 overflow-hidden [&>button]:hidden">
        <div className="flex flex-col h-full bg-zinc-900">
          {/* Top toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 text-white border-b border-zinc-700">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">{title || "Annotate Image"}</h3>
              {!readOnly && (
                <span className="text-xs text-zinc-400">
                  ({annotations.length} annotation{annotations.length !== 1 ? "s" : ""})
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tool bar */}
          {!readOnly && (
            <div className="flex items-center gap-1 px-4 py-2 bg-zinc-800 text-white border-b border-zinc-700 flex-wrap">
              {/* Drawing tools */}
              {TOOLS.map((t) => (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="sm"
                  className={`h-8 text-xs ${
                    tool === t.id
                      ? "bg-white/20 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-white/10"
                  }`}
                  onClick={() => setTool(t.id)}
                  title={t.label}
                >
                  <t.icon className="h-3.5 w-3.5 mr-1" />
                  {t.label}
                </Button>
              ))}

              <div className="w-px h-5 bg-zinc-600 mx-1" />

              {/* Color picker */}
              <Palette className="h-3.5 w-3.5 text-zinc-400" />
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-5 h-5 rounded-full border-2 transition ${
                    color === c ? "border-white scale-110" : "border-zinc-600"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}

              <div className="w-px h-5 bg-zinc-600 mx-1" />

              {/* Line width */}
              <span className="text-xs text-zinc-400">Width:</span>
              <input
                type="range"
                min={1}
                max={10}
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-16 h-1 accent-white"
              />

              <div className="w-px h-5 bg-zinc-600 mx-1" />

              {/* Undo/Redo/Clear */}
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white hover:bg-white/10 h-8 w-8"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white hover:bg-white/10 h-8 w-8"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white hover:bg-white/10 h-8 w-8"
                onClick={handleClearAll}
                disabled={annotations.length === 0}
                title="Clear all"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Canvas area */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center overflow-hidden relative"
          >
            {imageLoaded && canvasSize.w > 0 && (
              <div className="relative" style={{ width: canvasSize.w, height: canvasSize.h }}>
                <canvas
                  ref={canvasRef}
                  width={canvasSize.w}
                  height={canvasSize.h}
                  className="absolute top-0 left-0"
                />
                <canvas
                  ref={overlayRef}
                  width={canvasSize.w}
                  height={canvasSize.h}
                  className="absolute top-0 left-0"
                  style={{ cursor: readOnly ? "default" : tool === "text" ? "text" : "crosshair" }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />

                {/* Text input popup */}
                {textPosition && (
                  <div
                    className="absolute z-20"
                    style={{
                      left: textPosition.x * canvasSize.w,
                      top: textPosition.y * canvasSize.h,
                    }}
                  >
                    <input
                      type="text"
                      autoFocus
                      className="px-2 py-1 text-sm bg-black/80 text-white border border-zinc-500 rounded outline-none min-w-[150px]"
                      placeholder="Type text..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleTextSubmit()
                        if (e.key === "Escape") {
                          setTextPosition(null)
                          setTextInput("")
                        }
                      }}
                      onBlur={handleTextSubmit}
                    />
                  </div>
                )}
              </div>
            )}

            {!imageLoaded && (
              <div className="text-zinc-400 flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading image...
              </div>
            )}
          </div>

          {/* Footer */}
          {!readOnly && (
            <DialogFooter className="px-4 py-3 bg-zinc-800 border-t border-zinc-700">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Save Annotations
              </Button>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Draw a single annotation onto a canvas context */
function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  canvasW: number,
  canvasH: number
) {
  ctx.strokeStyle = ann.color
  ctx.fillStyle = ann.color
  ctx.lineWidth = ann.lineWidth
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  const pts = ann.points
  const toX = (n: number) => n * canvasW
  const toY = (n: number) => n * canvasH

  switch (ann.type) {
    case "freehand": {
      if (pts.length < 4) break
      ctx.beginPath()
      ctx.moveTo(toX(pts[0]), toY(pts[1]))
      for (let i = 2; i < pts.length; i += 2) {
        ctx.lineTo(toX(pts[i]), toY(pts[i + 1]))
      }
      ctx.stroke()
      break
    }

    case "line": {
      if (pts.length < 4) break
      ctx.beginPath()
      ctx.moveTo(toX(pts[0]), toY(pts[1]))
      ctx.lineTo(toX(pts[2]), toY(pts[3]))
      ctx.stroke()
      break
    }

    case "arrow": {
      if (pts.length < 4) break
      const x1 = toX(pts[0]), y1 = toY(pts[1])
      const x2 = toX(pts[2]), y2 = toY(pts[3])

      // Line
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      // Arrowhead
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const headLen = 12 + ann.lineWidth * 2
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      )
      ctx.moveTo(x2, y2)
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      )
      ctx.stroke()
      break
    }

    case "circle": {
      if (pts.length < 4) break
      const cx = toX((pts[0] + pts[2]) / 2)
      const cy = toY((pts[1] + pts[3]) / 2)
      const rx = Math.abs(toX(pts[2]) - toX(pts[0])) / 2
      const ry = Math.abs(toY(pts[3]) - toY(pts[1])) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
      ctx.stroke()
      break
    }

    case "rectangle": {
      if (pts.length < 4) break
      const rx1 = toX(pts[0]), ry1 = toY(pts[1])
      const rw = toX(pts[2]) - rx1, rh = toY(pts[3]) - ry1
      ctx.beginPath()
      ctx.rect(rx1, ry1, rw, rh)
      ctx.stroke()
      break
    }

    case "text": {
      if (!ann.text) break
      const fontSize = Math.max(14, ann.lineWidth * 4)
      ctx.font = `${fontSize}px sans-serif`
      ctx.fillStyle = ann.color

      // Text shadow for readability
      ctx.shadowColor = "rgba(0,0,0,0.7)"
      ctx.shadowBlur = 3
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      ctx.fillText(ann.text, toX(pts[0]), toY(pts[1]))
      ctx.shadowColor = "transparent"
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      break
    }
  }
}
