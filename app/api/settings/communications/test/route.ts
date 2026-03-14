import { NextRequest, NextResponse } from "next/server"
import { requireAuthAndRole } from "@/lib/api-helpers"
import { smsService } from "@/lib/services/sms.service"
import { emailService } from "@/lib/services/email.service"

// POST - Test SMS or email connection
export async function POST(request: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN'])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, testData } = body

    if (!type) {
      return NextResponse.json(
        { error: "Type is required" },
        { status: 400 }
      )
    }

    if (type !== 'sms' && type !== 'email') {
      return NextResponse.json(
        { error: "Type must be 'sms' or 'email'" },
        { status: 400 }
      )
    }

    // Test SMS connection
    if (type === 'sms') {
      if (!testData?.phone) {
        return NextResponse.json(
          { error: "Phone number is required for SMS test" },
          { status: 400 }
        )
      }

      try {
        // Initialize SMS service with current settings
        await smsService.initialize()

        // Send test SMS
        const testMessage = testData.message ||
          "This is a test message from DentalERP. Your SMS gateway is configured correctly."

        await smsService.sendSMS({
          phone: testData.phone,
          message: testMessage
        })

        return NextResponse.json({
          success: true,
          message: "Test SMS sent successfully",
          details: `SMS sent to ${testData.phone}`
        })
      } catch (error: any) {
        console.error("SMS test failed:", error)
        return NextResponse.json(
          {
            success: false,
            error: "Failed to send test SMS",
            details: error.message
          },
          { status: 400 }
        )
      }
    }

    // Test Email connection
    if (type === 'email') {
      if (!testData?.email) {
        return NextResponse.json(
          { error: "Email address is required for email test" },
          { status: 400 }
        )
      }

      try {
        // Initialize email service with current settings
        await emailService.initialize()

        // Send test email
        const testSubject = testData.subject ||
          "Test Email from DentalERP"

        const testBody = testData.body || `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Email Configuration Test</h2>
            <p>Hello,</p>
            <p>This is a test email from DentalERP.</p>
            <p>If you're receiving this email, your SMTP settings are configured correctly.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">
              Sent from Dental Hospital Management System<br>
              DentalERP
            </p>
          </div>
        `

        await emailService.sendEmail({
          to: testData.email,
          subject: testSubject,
          body: testBody
        })

        return NextResponse.json({
          success: true,
          message: "Test email sent successfully",
          details: `Email sent to ${testData.email}`
        })
      } catch (error: any) {
        console.error("Email test failed:", error)
        return NextResponse.json(
          {
            success: false,
            error: "Failed to send test email",
            details: error.message
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  } catch (error: any) {
    console.error("Error testing communication settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to test communication settings",
        details: error.message
      },
      { status: 500 }
    )
  }
}
