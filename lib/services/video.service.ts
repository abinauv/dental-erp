/**
 * Video Consultation Service
 *
 * Uses Daily.co REST API for video room management.
 * Env vars: DAILY_API_KEY, DAILY_DOMAIN (optional, defaults to daily.co)
 *
 * If DAILY_API_KEY is not set, falls back to Jitsi Meet (free, no API key needed).
 */

const DAILY_API_BASE = "https://api.daily.co/v1"

function getDailyApiKey(): string | null {
  return process.env.DAILY_API_KEY || null
}

function getDailyDomain(): string {
  return process.env.DAILY_DOMAIN || "your-domain.daily.co"
}

function getJitsiDomain(): string {
  return process.env.JITSI_DOMAIN || "meet.jit.si"
}

export type VideoProvider = "daily" | "jitsi"

export function getVideoProvider(): VideoProvider {
  return getDailyApiKey() ? "daily" : "jitsi"
}

// ── Daily.co API helpers ──

async function dailyFetch(path: string, options: RequestInit = {}) {
  const apiKey = getDailyApiKey()
  if (!apiKey) throw new Error("DAILY_API_KEY not configured")

  const res = await fetch(`${DAILY_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Daily.co API error ${res.status}: ${body}`)
  }

  return res.json()
}

// ── Room Management ──

interface CreateRoomResult {
  roomUrl: string
  roomName: string
  provider: VideoProvider
}

/**
 * Create a video room for a consultation.
 * - Daily.co: creates a room via API with auto-expiry
 * - Jitsi: generates a deterministic room URL (no API call needed)
 */
export async function createRoom(consultationId: string): Promise<CreateRoomResult> {
  const provider = getVideoProvider()

  if (provider === "daily") {
    const roomName = `dental-${consultationId}`
    const expiryTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24h from now

    const room = await dailyFetch("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          exp: expiryTime,
          max_participants: 10,
          enable_chat: true,
          enable_screenshare: true,
          enable_recording: false,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    })

    return {
      roomUrl: room.url,
      roomName: room.name,
      provider: "daily",
    }
  }

  // Jitsi fallback — no API needed
  const roomName = `DentalConsult-${consultationId}`
  const jitsiDomain = getJitsiDomain()

  return {
    roomUrl: `https://${jitsiDomain}/${roomName}`,
    roomName,
    provider: "jitsi",
  }
}

/**
 * Delete a video room (cleanup).
 * Only applicable for Daily.co — Jitsi rooms are ephemeral.
 */
export async function deleteRoom(roomName: string): Promise<void> {
  const provider = getVideoProvider()
  if (provider !== "daily") return

  try {
    await dailyFetch(`/rooms/${roomName}`, { method: "DELETE" })
  } catch {
    // Room may already be expired/deleted — ignore
  }
}

/**
 * Generate a meeting token for a participant.
 * Daily.co: creates a signed token with role-based permissions.
 * Jitsi: returns null (Jitsi handles auth differently).
 */
export async function getRoomToken(
  roomName: string,
  participantName: string,
  isDoctor: boolean
): Promise<string | null> {
  const provider = getVideoProvider()
  if (provider !== "daily") return null

  const expiryTime = Math.floor(Date.now() / 1000) + 4 * 60 * 60 // 4h

  const token = await dailyFetch("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: participantName,
        exp: expiryTime,
        is_owner: isDoctor,
        enable_screenshare: true,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  })

  return token.token
}

/**
 * Get room details (e.g., active participants count).
 * Only available with Daily.co.
 */
export async function getRoomInfo(roomName: string) {
  const provider = getVideoProvider()
  if (provider !== "daily") return null

  try {
    return await dailyFetch(`/rooms/${roomName}`)
  } catch {
    return null
  }
}
