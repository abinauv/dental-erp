import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

// GET - Retrieve SMS and email settings
export async function GET(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Fetch all communication settings
    const settings = await prisma.setting.findMany({
      where: {
        hospitalId,
        category: {
          in: ['sms', 'email', 'reviews']
        }
      }
    })

    // Organize settings by category
    const smsSettings: Record<string, string> = {}
    const emailSettings: Record<string, string> = {}

    settings.forEach(setting => {
      if (setting.category === 'sms') {
        const key = setting.key.replace('sms.', '')
        smsSettings[key] = setting.value
      } else if (setting.category === 'email') {
        const key = setting.key.replace('email.', '').replace('.', '_')
        emailSettings[key] = setting.value
      }
    })

    // Also check for consolidated JSON settings
    const smsSettingsJson = await prisma.setting.findUnique({
      where: { hospitalId_key: { key: 'sms_settings', hospitalId } }
    })

    const emailSettingsJson = await prisma.setting.findUnique({
      where: { hospitalId_key: { key: 'email_settings', hospitalId } }
    })

    const reviewSettingsJson = await prisma.setting.findUnique({
      where: { hospitalId_key: { key: 'reviews_settings', hospitalId } }
    })

    return NextResponse.json({
      sms: smsSettingsJson ? JSON.parse(smsSettingsJson.value) : smsSettings,
      email: emailSettingsJson ? JSON.parse(emailSettingsJson.value) : emailSettings,
      reviews: reviewSettingsJson ? JSON.parse(reviewSettingsJson.value) : {}
    })
  } catch (error) {
    console.error("Error fetching communication settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch communication settings" },
      { status: 500 }
    )
  }
}

// POST - Save SMS or email settings
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole()
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, settings } = body

    if (!type || !settings) {
      return NextResponse.json(
        { error: "Type and settings are required" },
        { status: 400 }
      )
    }

    if (type !== 'sms' && type !== 'email' && type !== 'reviews') {
      return NextResponse.json(
        { error: "Type must be 'sms', 'email', or 'reviews'" },
        { status: 400 }
      )
    }

    // Store settings as JSON in a single setting record
    const settingKey = `${type}_settings`

    await prisma.setting.upsert({
      where: { hospitalId_key: { key: settingKey, hospitalId } },
      update: {
        value: JSON.stringify(settings),
        type: 'json',
        category: type,
        updatedAt: new Date()
      },
      create: {
        key: settingKey,
        value: JSON.stringify(settings),
        type: 'json',
        category: type,
        description: `${type.toUpperCase()} configuration settings`,
        hospitalId,
      }
    })

    // Also store individual settings for backward compatibility
    const settingsArray = []

    if (type === 'sms') {
      settingsArray.push(
        { key: 'sms.gateway', value: settings.gateway || '', category: 'sms' },
        { key: 'sms.apiKey', value: settings.apiKey || '', category: 'sms' },
        { key: 'sms.senderId', value: settings.senderId || '', category: 'sms' },
        { key: 'sms.route', value: settings.route || '4', category: 'sms' },
        { key: 'sms.enabled', value: String(settings.enabled ?? true), category: 'sms' }
      )
    } else if (type === 'reviews') {
      settingsArray.push(
        { key: 'google_review_url', value: settings.google_review_url || '', category: 'reviews' },
        { key: 'auto_review_requests', value: String(settings.auto_review_requests ?? false), category: 'reviews' },
        { key: 'review_request_delay_hours', value: String(settings.review_request_delay_hours || '2'), category: 'reviews' }
      )
    } else {
      settingsArray.push(
        { key: 'email.smtp.host', value: settings.smtp_host || '', category: 'email' },
        { key: 'email.smtp.port', value: settings.smtp_port || '587', category: 'email' },
        { key: 'email.smtp.secure', value: String(settings.smtp_secure ?? false), category: 'email' },
        { key: 'email.smtp.user', value: settings.smtp_user || '', category: 'email' },
        { key: 'email.smtp.password', value: settings.smtp_password || '', category: 'email' },
        { key: 'email.from.name', value: settings.from_name || '', category: 'email' },
        { key: 'email.from.email', value: settings.from_email || '', category: 'email' },
        { key: 'email.replyTo', value: settings.replyTo || '', category: 'email' },
        { key: 'email.enabled', value: String(settings.enabled ?? true), category: 'email' }
      )
    }

    // Upsert all individual settings
    for (const setting of settingsArray) {
      await prisma.setting.upsert({
        where: { hospitalId_key: { key: setting.key, hospitalId } },
        update: {
          value: setting.value,
          updatedAt: new Date()
        },
        create: {
          key: setting.key,
          value: setting.value,
          category: setting.category,
          type: 'string',
          hospitalId,
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `${type.toUpperCase()} settings saved successfully`
    })
  } catch (error) {
    console.error("Error saving communication settings:", error)
    return NextResponse.json(
      { error: "Failed to save communication settings" },
      { status: 500 }
    )
  }
}
