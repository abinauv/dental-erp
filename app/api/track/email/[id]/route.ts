import { prisma } from "@/lib/prisma"

// 1x1 transparent PNG pixel (68 bytes)
const TRACKING_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
)

/**
 * GET /api/track/email/[id]
 * Email open tracking pixel. Embedded in outgoing HTML emails as <img src="...">
 * Updates EmailLog.openedAt on first load.
 * No auth required — this is loaded by email clients.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trackingId } = await params

  // Update openedAt in background — don't block the pixel response
  prisma.emailLog
    .updateMany({
      where: { trackingId, openedAt: null },
      data: { openedAt: new Date() },
    })
    .catch(() => {
      // Silently ignore errors — tracking should never break the email experience
    })

  return new Response(TRACKING_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(TRACKING_PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  })
}
