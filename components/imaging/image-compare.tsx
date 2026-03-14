"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import {
  X,
  Columns2,
  SplitSquareHorizontal,
} from "lucide-react"

interface CompareImage {
  src: string
  title: string
  date?: string
}

interface ImageCompareProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  before: CompareImage
  after: CompareImage
}

export function ImageCompare({
  open,
  onOpenChange,
  before,
  after,
}: ImageCompareProps) {
  const [mode, setMode] = useState<"side-by-side" | "slider">("side-by-side")
  const [sliderPos, setSliderPos] = useState(50) // percentage
  const [isDragging, setIsDragging] = useState(false)
  const sliderContainerRef = useRef<HTMLDivElement>(null)

  // Synchronized zoom/pan for side-by-side
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (open) {
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setSliderPos(50)
    }
  }, [open])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => {
      const newZ = e.deltaY < 0 ? z + 0.1 : z - 0.1
      return Math.max(0.25, Math.min(5, newZ))
    })
  }, [])

  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    },
    [zoom, pan]
  )

  const handlePanMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    },
    [isPanning, panStart]
  )

  const handlePanEnd = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleSliderMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !sliderContainerRef.current) return
      const rect = sliderContainerRef.current.getBoundingClientRect()
      const pos = ((e.clientX - rect.left) / rect.width) * 100
      setSliderPos(Math.max(0, Math.min(100, pos)))
    },
    [isDragging]
  )

  const handleSliderDown = useCallback(
    (e: React.MouseEvent) => {
      if (!sliderContainerRef.current) return
      setIsDragging(true)
      const rect = sliderContainerRef.current.getBoundingClientRect()
      const pos = ((e.clientX - rect.left) / rect.width) * 100
      setSliderPos(Math.max(0, Math.min(100, pos)))
    },
    []
  )

  useEffect(() => {
    const handleUp = () => setIsDragging(false)
    window.addEventListener("mouseup", handleUp)
    return () => window.removeEventListener("mouseup", handleUp)
  }, [])

  const imageStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transition: isPanning ? "none" : "transform 0.2s ease",
    objectFit: "contain" as const,
    width: "100%",
    height: "100%",
    userSelect: "none" as const,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0 overflow-hidden [&>button]:hidden">
        <div className="flex flex-col h-full bg-black">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 text-white z-10">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-medium">Compare Images</h3>
              <div className="flex items-center gap-1 bg-white/10 rounded-md p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs ${
                    mode === "side-by-side"
                      ? "bg-white/20 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                  onClick={() => setMode("side-by-side")}
                >
                  <Columns2 className="h-3.5 w-3.5 mr-1" />
                  Side by Side
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs ${
                    mode === "slider"
                      ? "bg-white/20 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                  onClick={() => setMode("slider")}
                >
                  <SplitSquareHorizontal className="h-3.5 w-3.5 mr-1" />
                  Slider
                </Button>
              </div>
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

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {mode === "side-by-side" ? (
              <div
                className="flex h-full gap-1"
                onWheel={handleWheel}
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
              >
                {/* Before */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-3 py-1 bg-zinc-900 text-center">
                    <span className="text-xs text-zinc-400">Before</span>
                    <span className="text-xs text-zinc-500 ml-2">{before.title}</span>
                    {before.date && (
                      <span className="text-xs text-zinc-600 ml-1">({before.date})</span>
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-center overflow-hidden bg-zinc-950">
                    <img
                      src={before.src}
                      alt={before.title}
                      style={imageStyle}
                      draggable={false}
                    />
                  </div>
                </div>

                {/* After */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-3 py-1 bg-zinc-900 text-center">
                    <span className="text-xs text-zinc-400">After</span>
                    <span className="text-xs text-zinc-500 ml-2">{after.title}</span>
                    {after.date && (
                      <span className="text-xs text-zinc-600 ml-1">({after.date})</span>
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-center overflow-hidden bg-zinc-950">
                    <img
                      src={after.src}
                      alt={after.title}
                      style={imageStyle}
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Slider mode */
              <div
                ref={sliderContainerRef}
                className="relative h-full cursor-col-resize select-none"
                onMouseDown={handleSliderDown}
                onMouseMove={handleSliderMove}
              >
                {/* After image (full) */}
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                  <img
                    src={after.src}
                    alt={after.title}
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                </div>

                {/* Before image (clipped) */}
                <div
                  className="absolute inset-0 flex items-center justify-center bg-zinc-950 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                >
                  <img
                    src={before.src}
                    alt={before.title}
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                  />
                </div>

                {/* Slider handle */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                    <SplitSquareHorizontal className="h-4 w-4 text-zinc-800" />
                  </div>
                </div>

                {/* Labels */}
                <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-xs text-white z-20">
                  Before
                </div>
                <div className="absolute top-3 right-3 bg-black/60 px-2 py-1 rounded text-xs text-white z-20">
                  After
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
