/**
 * Email helper functions for system emails (invites, verification, etc.)
 * These wrap the email service with graceful failure — if SMTP is not
 * configured, the calling operation still succeeds.
 */

import { emailService } from '@/lib/services/email.service'
import { logger } from '@/lib/logger'

const APP_NAME = 'DentalERP'

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// The email log keeps a copy of every email, and staff can read it, so a
// link that grants access (an invite, a verification or a password reset) is
// logged with its token removed.
export const REDACTED_TOKEN = '[removed]'
function redactLink(html: string, link: string, token: string): string {
  return html.split(link).join(link.replace(token, REDACTED_TOKEN))
}

function wrapHTML(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background: #f4f4f5; }
    .wrapper { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { font-size: 20px; font-weight: 700; color: #0284c7; margin-bottom: 24px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { margin: 0 0 16px; color: #4a4a4a; font-size: 15px; }
    .btn { display: inline-block; padding: 12px 28px; background: #0284c7; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .btn:hover { background: #0369a1; }
    .muted { font-size: 13px; color: #71717a; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #a1a1aa; }
    .divider { border: none; border-top: 1px solid #e4e4e7; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated email from ${APP_NAME}. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`.trim()
}

/**
 * Send a staff invitation email.
 * Non-blocking — logs errors but does not throw.
 */
export async function sendInviteEmail(params: {
  hospitalId: string
  to: string
  inviteeName: string
  hospitalName: string
  role: string
  inviterName: string
  token: string
}): Promise<boolean> {
  const { hospitalId, to, inviteeName, hospitalName, role, inviterName, token } = params
  const link = `${baseUrl()}/invite/accept?token=${token}`
  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase().replace('_', ' ')

  const html = wrapHTML(`
    <div class="logo">${APP_NAME}</div>
    <h1>You're invited to join ${hospitalName}</h1>
    <p>Hi ${inviteeName},</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${hospitalName}</strong> as a <strong>${roleLabel}</strong>.</p>
    <p>Click the button below to accept the invitation and create your account:</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${link}" class="btn">Accept Invitation</a>
    </p>
    <hr class="divider">
    <p class="muted">This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.</p>
    <p class="muted">Or copy this link: ${link}</p>
  `)

  try {
    await emailService.sendEmail({
      hospitalId,
      to,
      subject: `You're invited to join ${hospitalName} on ${APP_NAME}`,
      body: html,
      logBody: redactLink(html, link, token),
    })
    return true
  } catch (err) {
    logger.error({ err }, `[email-helpers] Failed to send invite email to ${to}:`)
    return false
  }
}

/**
 * Send an email verification link after signup.
 * Non-blocking — logs errors but does not throw.
 */
export async function sendVerificationEmail(params: {
  hospitalId: string
  to: string
  userName: string
  hospitalName: string
  token: string
}): Promise<boolean> {
  const { hospitalId, to, userName, hospitalName, token } = params
  const link = `${baseUrl()}/verify-email?token=${token}`

  const html = wrapHTML(`
    <div class="logo">${APP_NAME}</div>
    <h1>Verify your email address</h1>
    <p>Hi ${userName},</p>
    <p>Thank you for registering <strong>${hospitalName}</strong> on ${APP_NAME}. Please verify your email to activate your account:</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${link}" class="btn">Verify Email</a>
    </p>
    <hr class="divider">
    <p class="muted">This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</p>
    <p class="muted">Or copy this link: ${link}</p>
  `)

  try {
    await emailService.sendEmail({
      hospitalId,
      to,
      subject: `Verify your email — ${APP_NAME}`,
      body: html,
      logBody: redactLink(html, link, token),
    })
    return true
  } catch (err) {
    logger.error({ err }, `[email-helpers] Failed to send verification email to ${to}:`)
    return false
  }
}

/**
 * Send a password-reset link (Better Auth's /request-password-reset).
 * Non-blocking — logs errors but does not throw.
 */
export async function sendPasswordResetEmail(params: {
  hospitalId: string
  to: string
  userName: string
  url: string
  token: string
}): Promise<boolean> {
  const { hospitalId, to, userName, url, token } = params

  const html = wrapHTML(`
    <div class="logo">${APP_NAME}</div>
    <h1>Reset your password</h1>
    <p>Hi ${userName},</p>
    <p>Someone asked to reset the password for your ${APP_NAME} account. If it was you, choose a new password here:</p>
    <p style="text-align:center; margin: 28px 0;">
      <a href="${url}" class="btn">Choose a New Password</a>
    </p>
    <hr class="divider">
    <p class="muted">This link works once and expires in 1 hour. If you didn't ask for it, ignore this email: your password stays the same.</p>
    <p class="muted">Or copy this link: ${url}</p>
  `)

  try {
    await emailService.sendEmail({
      hospitalId,
      to,
      subject: `Reset your ${APP_NAME} password`,
      body: html,
      logBody: redactLink(html, url, token),
    })
    return true
  } catch (err) {
    logger.error({ err }, `[email-helpers] Failed to send password reset email to ${to}:`)
    return false
  }
}
