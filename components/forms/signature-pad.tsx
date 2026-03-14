"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Eraser, Undo2 } from "lucide-react"

interface SignaturePadProps {
  onSignatureChange: (signature: string | null) => void
  initialSignature?: string | null
  width?: number
  height?: number
  label?: string
}

export function SignaturePad({
  onSignatureChange,
  initialSignature,
  width = 500,
  height = 200,
  label = "I agree to the terms and conditions above",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [history, setHistory] = useState<ImageData[]>([])

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext("2d")
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas resolution for crisp lines
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // Draw initial signature if provided
    if (initialSignature) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
        setHasSignature(true)
        setAgreed(true)
      }
      img.src = initialSignature
    } else {
      // Draw placeholder line
      ctx.strokeStyle = "#e5e7eb"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(20, height - 40)
      ctx.lineTo(width - 20, height - 40)
      ctx.stroke()

      ctx.fillStyle = "#9ca3af"
      ctx.font = "14px sans-serif"
      ctx.fillText("Sign here", 20, height - 20)
    }
  }, [width, height, initialSignature])

  const getPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const saveState = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setHistory((prev) => [...prev.slice(-10), data])
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = getCtx()
    if (!ctx) return

    saveState()
    const { x, y } = getPosition(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = "#1a1a2e"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = getCtx()
    if (!ctx) return

    const { x, y } = getPosition(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const ctx = getCtx()
    if (ctx) ctx.closePath()
    emitSignature()
  }

  const emitSignature = () => {
    if (!canvasRef.current || !agreed) return
    const data = canvasRef.current.toDataURL("image/png")
    onSignatureChange(data)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const dpr = window.devicePixelRatio || 1

    // Redraw placeholder
    ctx.strokeStyle = "#e5e7eb"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, height - 40)
    ctx.lineTo(width - 20, height - 40)
    ctx.stroke()
    ctx.fillStyle = "#9ca3af"
    ctx.font = "14px sans-serif"
    ctx.fillText("Sign here", 20, height - 20)

    setHasSignature(false)
    setHistory([])
    onSignatureChange(null)
  }

  const undo = () => {
    const canvas = canvasRef.current
    if (!canvas || history.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const prev = history[history.length - 1]
    ctx.putImageData(prev, 0, 0)
    setHistory((h) => h.slice(0, -1))
    emitSignature()
  }

  const handleAgreeChange = (checked: boolean) => {
    setAgreed(checked)
    if (checked && hasSignature && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL("image/png"))
    } else {
      onSignatureChange(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative border rounded-lg bg-background overflow-hidden" style={{ width, height }}>
        <canvas
          ref={canvasRef}
          className="cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={undo}
          disabled={history.length === 0}
        >
          <Undo2 className="h-4 w-4 mr-1" />
          Undo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          disabled={!hasSignature}
        >
          <Eraser className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>
      <div className="flex items-start gap-2">
        <Checkbox
          id="agree"
          checked={agreed}
          onCheckedChange={(checked) => handleAgreeChange(checked === true)}
        />
        <label htmlFor="agree" className="text-sm text-muted-foreground leading-tight cursor-pointer">
          {label}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Signed on: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
      </p>
    </div>
  )
}
