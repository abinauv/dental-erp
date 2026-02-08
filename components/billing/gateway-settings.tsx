"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  CreditCard,
  Save,
  Loader2,
  Copy,
  Check,
  Shield,
  ExternalLink,
} from "lucide-react"

interface GatewayConfig {
  provider: string
  isEnabled: boolean
  isLiveMode: boolean
  razorpayKeyId: string | null
  razorpayKeySecret: string | null
  phonepeMerchantId: string | null
  phonepeSaltKey: string | null
  phonepeSaltIndex: string | null
  paytmMid: string | null
  paytmMerchantKey: string | null
  paytmWebsite: string | null
  webhookUrl: string | null
}

export function GatewaySettings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [provider, setProvider] = useState("")
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLiveMode, setIsLiveMode] = useState(false)

  // Razorpay
  const [razorpayKeyId, setRazorpayKeyId] = useState("")
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("")

  // PhonePe
  const [phonepeMerchantId, setPhonepeMerchantId] = useState("")
  const [phonepeSaltKey, setPhonepeSaltKey] = useState("")
  const [phonepeSaltIndex, setPhonepeSaltIndex] = useState("1")

  // Paytm
  const [paytmMid, setPaytmMid] = useState("")
  const [paytmMerchantKey, setPaytmMerchantKey] = useState("")
  const [paytmWebsite, setPaytmWebsite] = useState("WEBSTAGING")

  const [webhookUrl, setWebhookUrl] = useState("")

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/settings/billing/gateway")
      if (!res.ok) return
      const data = await res.json()

      if (data.config) {
        const c = data.config as GatewayConfig
        setProvider(c.provider || "")
        setIsEnabled(c.isEnabled)
        setIsLiveMode(c.isLiveMode)
        setRazorpayKeyId(c.razorpayKeyId || "")
        setRazorpayKeySecret(c.razorpayKeySecret || "")
        setPhonepeMerchantId(c.phonepeMerchantId || "")
        setPhonepeSaltKey(c.phonepeSaltKey || "")
        setPhonepeSaltIndex(c.phonepeSaltIndex || "1")
        setPaytmMid(c.paytmMid || "")
        setPaytmMerchantKey(c.paytmMerchantKey || "")
        setPaytmWebsite(c.paytmWebsite || "WEBSTAGING")
        setWebhookUrl(c.webhookUrl || "")
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!provider) {
      toast({
        title: "Error",
        description: "Please select a payment provider",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/settings/billing/gateway", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          isEnabled,
          isLiveMode,
          razorpayKeyId,
          razorpayKeySecret,
          phonepeMerchantId,
          phonepeSaltKey,
          phonepeSaltIndex,
          paytmMid,
          paytmMerchantKey,
          paytmWebsite,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }

      const data = await res.json()
      setWebhookUrl(data.config?.webhookUrl || "")

      toast({
        title: "Success",
        description: "Payment gateway settings saved",
      })

      // Refresh to get masked secrets
      fetchConfig()
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const copyWebhookUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Gateway
            </CardTitle>
            <CardDescription>
              Connect your own Razorpay, PhonePe, or Paytm merchant account to
              accept online payments
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isEnabled && (
              <Badge variant="default" className="bg-green-100 text-green-700 border-0">
                Active
              </Badge>
            )}
            {isLiveMode && (
              <Badge variant="default" className="bg-blue-100 text-blue-700 border-0">
                Live
              </Badge>
            )}
            {!isLiveMode && provider && (
              <Badge variant="secondary">Test Mode</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Payment Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RAZORPAY">Razorpay</SelectItem>
                <SelectItem value="PHONEPE">PhonePe</SelectItem>
                <SelectItem value="PAYTM">Paytm</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Use your own merchant account credentials
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="gateway-enabled">Enable Online Payments</Label>
              <Switch
                id="gateway-enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="gateway-live">
                Live Mode
                <span className="text-xs text-muted-foreground ml-1">
                  (uncheck for test/sandbox)
                </span>
              </Label>
              <Switch
                id="gateway-live"
                checked={isLiveMode}
                onCheckedChange={setIsLiveMode}
              />
            </div>
          </div>
        </div>

        {/* Razorpay Credentials */}
        {provider === "RAZORPAY" && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">Razorpay Credentials</h4>
            <p className="text-xs text-muted-foreground">
              Get these from your{" "}
              <a
                href="https://dashboard.razorpay.com/app/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                Razorpay Dashboard <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rzp-key-id">Key ID</Label>
                <Input
                  id="rzp-key-id"
                  value={razorpayKeyId}
                  onChange={(e) => setRazorpayKeyId(e.target.value)}
                  placeholder="rzp_test_..."
                />
              </div>
              <div>
                <Label htmlFor="rzp-key-secret">
                  Key Secret
                  <Shield className="h-3 w-3 inline ml-1 text-muted-foreground" />
                </Label>
                <Input
                  id="rzp-key-secret"
                  type="password"
                  value={razorpayKeySecret}
                  onChange={(e) => setRazorpayKeySecret(e.target.value)}
                  placeholder="Enter key secret"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Stored encrypted. Leave unchanged to keep existing.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PhonePe Credentials */}
        {provider === "PHONEPE" && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">PhonePe PG Credentials</h4>
            <p className="text-xs text-muted-foreground">
              Get these from your{" "}
              <a
                href="https://business.phonepe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                PhonePe Business Dashboard <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="pp-merchant-id">Merchant ID</Label>
                <Input
                  id="pp-merchant-id"
                  value={phonepeMerchantId}
                  onChange={(e) => setPhonepeMerchantId(e.target.value)}
                  placeholder="MERCHANTUAT"
                />
              </div>
              <div>
                <Label htmlFor="pp-salt-key">
                  Salt Key
                  <Shield className="h-3 w-3 inline ml-1 text-muted-foreground" />
                </Label>
                <Input
                  id="pp-salt-key"
                  type="password"
                  value={phonepeSaltKey}
                  onChange={(e) => setPhonepeSaltKey(e.target.value)}
                  placeholder="Enter salt key"
                />
              </div>
              <div>
                <Label htmlFor="pp-salt-index">Salt Index</Label>
                <Input
                  id="pp-salt-index"
                  value={phonepeSaltIndex}
                  onChange={(e) => setPhonepeSaltIndex(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Paytm Credentials */}
        {provider === "PAYTM" && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">Paytm PG Credentials</h4>
            <p className="text-xs text-muted-foreground">
              Get these from your{" "}
              <a
                href="https://business.paytm.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                Paytm Business Dashboard <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ptm-mid">Merchant ID (MID)</Label>
                <Input
                  id="ptm-mid"
                  value={paytmMid}
                  onChange={(e) => setPaytmMid(e.target.value)}
                  placeholder="YOUR_MID"
                />
              </div>
              <div>
                <Label htmlFor="ptm-key">
                  Merchant Key
                  <Shield className="h-3 w-3 inline ml-1 text-muted-foreground" />
                </Label>
                <Input
                  id="ptm-key"
                  type="password"
                  value={paytmMerchantKey}
                  onChange={(e) => setPaytmMerchantKey(e.target.value)}
                  placeholder="Enter merchant key"
                />
              </div>
              <div>
                <Label htmlFor="ptm-website">Website</Label>
                <Select value={paytmWebsite} onValueChange={setPaytmWebsite}>
                  <SelectTrigger id="ptm-website">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEBSTAGING">WEBSTAGING (Test)</SelectItem>
                    <SelectItem value="DEFAULT">DEFAULT (Live)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Webhook URL */}
        {provider && webhookUrl && (
          <div className="border-t pt-4">
            <Label>Webhook URL</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Configure this URL in your {provider.charAt(0) + provider.slice(1).toLowerCase()} dashboard to receive payment notifications
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs bg-muted"
              />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving || !provider}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? "Saving..." : "Save Gateway Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
