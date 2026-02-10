"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  Camera,
  Upload,
  ArrowLeft,
  CheckCircle,
  Loader2,
  ImageIcon,
  X,
} from "lucide-react"

export default function UploadPhotoPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState("")

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Please select a JPEG, PNG, or WebP image")
      return
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError("File size must be under 10MB")
      return
    }

    setError("")
    setFile(selected)

    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(selected)
  }

  const removeFile = () => {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", file)
      if (description) formData.append("description", description)
      if (category) formData.append("category", category)

      const res = await fetch("/api/patient-portal/upload-photo", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Upload failed")
      }

      setUploaded(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (uploaded) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">Photo Uploaded Successfully</h2>
              <p className="text-muted-foreground">
                Your photo has been sent to your dentist for review. They will get back to you
                if an in-person visit is needed.
              </p>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setUploaded(false)
                    setFile(null)
                    setPreview(null)
                    setDescription("")
                    setCategory("")
                  }}
                >
                  Upload Another
                </Button>
                <Link href="/portal">
                  <Button>Back to Portal</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/portal">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Upload Photo</h1>
          <p className="text-sm text-muted-foreground">
            Send a dental photo to your doctor for triage
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Photo for Triage
          </CardTitle>
          <CardDescription>
            Take a clear photo of the area of concern. Your dentist will review it
            and advise whether an in-person visit is needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full rounded-lg border max-h-[300px] object-contain bg-gray-50"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Tap to take or select a photo</p>
                <p className="text-sm text-muted-foreground mt-1">
                  JPEG, PNG, or WebP (max 10MB)
                </p>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>What is the concern?</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pain">Pain / Toothache</SelectItem>
                <SelectItem value="swelling">Swelling</SelectItem>
                <SelectItem value="bleeding">Bleeding Gums</SelectItem>
                <SelectItem value="broken">Broken / Chipped Tooth</SelectItem>
                <SelectItem value="discoloration">Discoloration</SelectItem>
                <SelectItem value="sensitivity">Sensitivity</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your symptoms, when they started, and any other details..."
              rows={3}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Photo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">Tips for a good photo</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Use good lighting — natural light works best</li>
            <li>Keep the camera steady and in focus</li>
            <li>Show the affected area clearly</li>
            <li>Include surrounding teeth for context</li>
            <li>Use a mirror if photographing the inside of your mouth</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
