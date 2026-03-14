"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { downloadCSV, downloadExcel } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"

interface ExportMenuProps {
  /** Function that returns the data to export */
  getData: () => Record<string, unknown>[] | Promise<Record<string, unknown>[]>
  /** Base filename (without extension) */
  filename: string
  /** Optional sheet name for Excel */
  sheetName?: string
  /** Button variant */
  variant?: "outline" | "ghost" | "default"
  /** Button size */
  size?: "sm" | "default" | "icon"
}

export function ExportMenu({
  getData,
  filename,
  sheetName = "Data",
  variant = "outline",
  size = "sm",
}: ExportMenuProps) {
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(true)
    try {
      const data = await getData()
      if (!data || data.length === 0) {
        toast({ title: "No data", description: "Nothing to export", variant: "destructive" })
        return
      }
      if (format === "csv") {
        downloadCSV(data, filename)
      } else {
        await downloadExcel(data, filename, sheetName)
      }
      toast({ title: "Exported", description: `${data.length} rows exported as ${format.toUpperCase()}` })
    } catch {
      toast({ title: "Export failed", description: "Something went wrong during export", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
