"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Minimize2,
  Sun,
  Contrast,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react"

interface ImageViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  title?: string
  subtitle?: string
  /** All images for prev/next navigation */
  images?: { src: string; title: string; subtitle?: string }[]
  currentIndex?: number
  onIndexChange?: (index: number) => void
  onDownload?: () => void
  onAnnotate?: () => void
  onCompare?: () => void
}

export function ImageViewer({
  open,
  onOpenChange,
  src,
  title,
  subtitle,
  images,
  currentIndex = 0,
  onIndexChange,
  onDownload,
  onAnnotate,
  onCompare,
}: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)

  // Reset transforms when image changes
  useEffect(() => {
    resetTransforms()
  }, [src, currentIndex])

  const resetTransforms = useCallback(() => {
    setZoom(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setBrightness(100)
    setContrast(100)
    setPan({ x: 0, y: 0 })
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.25))
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + 0.1, 5))
    } else {
      setZoom((z) => Math.max(z - 0.1, 0.25))
    }
  }, [])

  const handleRotateCW = useCallback(() => {
    setRotation((r) => r + 90)
  }, [])

  const handleRotateCCW = useCallback(() => {
    setRotation((r) => r - 90)
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    },
    [zoom, pan]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    },
    [isPanning, panStart]
  )

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const handlePrev = useCallback(() => {
    if (!images || currentIndex <= 0) return
    onIndexChange?.(currentIndex - 1)
  }, [images, currentIndex, onIndexChange])

  const handleNext = useCallback(() => {
    if (!images || currentIndex >= images.length - 1) return
    onIndexChange?.(currentIndex + 1)
  }, [images, currentIndex, onIndexChange])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "+":
        case "=":
          handleZoomIn()
          break
        case "-":
          handleZoomOut()
          break
        case "r":
          handleRotateCW()
          break
        case "0":
          resetTransforms()
          break
        case "ArrowLeft":
          handlePrev()
          break
        case "ArrowRight":
          handleNext()
          break
        case "f":
          handleFullscreen()
          break
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, handleZoomIn, handleZoomOut, handleRotateCW, resetTransforms, handlePrev, handleNext, handleFullscreen])

  const imageStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
    filter: `brightness(${brightness}%) contrast(${contrast}%)`,
    cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default",
    transition: isPanning ? "none" : "transform 0.2s ease",
    maxHeight: "100%",
    maxWidth: "100%",
    objectFit: "contain" as const,
    userSelect: "none" as const,
  }

  const currentImage = images?.[currentIndex]
  const displayTitle = currentImage?.title || title
  const displaySubtitle = currentImage?.subtitle || subtitle
  const displaySrc = currentImage?.src || src

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0 overflow-hidden [&>button]:hidden">
        <div ref={containerRef} className="flex flex-col h-full bg-black">
          {/* Top toolbar */}
          {showControls && (
            <div className="flex items-center justify-between px-4 py-2 bg-black/80 text-white z-10">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium truncate">{displayTitle}</h3>
                {displaySubtitle && (
                  <p className="text-xs text-zinc-400 truncate">{displaySubtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {onAnnotate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 text-xs"
                    onClick={onAnnotate}
                  >
                    Annotate
                  </Button>
                )}
                {onCompare && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 text-xs"
                    onClick={onCompare}
                  >
                    Compare
                  </Button>
                )}
                {onDownload && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 h-8 w-8"
                    onClick={onDownload}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 h-8 w-8"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Image area */}
          <div
            className="flex-1 relative flex items-center justify-center overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setShowControls((s) => !s)}
          >
            {/* Navigation arrows */}
            {images && images.length > 1 && (
              <>
                {currentIndex > 0 && (
                  <button
                    className="absolute left-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePrev()
                    }}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                )}
                {currentIndex < images.length - 1 && (
                  <button
                    className="absolute right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNext()
                    }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                )}
              </>
            )}

            <img
              ref={imgRef}
              src={displaySrc}
              alt={displayTitle || "Image"}
              style={imageStyle}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Bottom toolbar */}
          {showControls && (
            <div className="flex items-center justify-center gap-1 px-4 py-2 bg-black/80 text-white z-10 flex-wrap">
              {/* Zoom controls */}
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={handleZoomOut} title="Zoom out (-)">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={handleZoomIn} title="Zoom in (+)">
                <ZoomIn className="h-4 w-4" />
              </Button>

              <div className="w-px h-5 bg-white/30 mx-1" />

              {/* Rotation */}
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={handleRotateCCW} title="Rotate left">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={handleRotateCW} title="Rotate right (R)">
                <RotateCw className="h-4 w-4" />
              </Button>

              <div className="w-px h-5 bg-white/30 mx-1" />

              {/* Flip */}
              <Button
                variant="ghost"
                size="icon"
                className={`hover:bg-white/20 h-8 w-8 ${flipH ? "text-blue-400" : "text-white"}`}
                onClick={() => setFlipH((f) => !f)}
                title="Flip horizontal"
              >
                <FlipHorizontal className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`hover:bg-white/20 h-8 w-8 ${flipV ? "text-blue-400" : "text-white"}`}
                onClick={() => setFlipV((f) => !f)}
                title="Flip vertical"
              >
                <FlipVertical className="h-4 w-4" />
              </Button>

              <div className="w-px h-5 bg-white/30 mx-1" />

              {/* Brightness */}
              <Sun className="h-3.5 w-3.5 text-zinc-400" />
              <input
                type="range"
                min={0}
                max={200}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-20 h-1 accent-white"
                title={`Brightness: ${brightness}%`}
                onClick={(e) => e.stopPropagation()}
              />

              {/* Contrast */}
              <Contrast className="h-3.5 w-3.5 text-zinc-400 ml-1" />
              <input
                type="range"
                min={0}
                max={200}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-20 h-1 accent-white"
                title={`Contrast: ${contrast}%`}
                onClick={(e) => e.stopPropagation()}
              />

              <div className="w-px h-5 bg-white/30 mx-1" />

              {/* Fullscreen */}
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={handleFullscreen} title="Fullscreen (F)">
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>

              {/* Reset */}
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 text-xs"
                onClick={resetTransforms}
                title="Reset (0)"
              >
                Reset
              </Button>

              {/* Image counter */}
              {images && images.length > 1 && (
                <>
                  <div className="w-px h-5 bg-white/30 mx-1" />
                  <span className="text-xs text-zinc-400">
                    {currentIndex + 1} / {images.length}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
