import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAndRole } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const securitySettingsSchema = z.object({
  passwordMinLength: z.number().int().min(6).max(32).optional(),
  passwordRequireUppercase: z.boolean().optional(),
  passwordRequireLowercase: z.boolean().optional(),
  passwordRequireNumbers: z.boolean().optional(),
  passwordRequireSpecialChars: z.boolean().optional(),
  passwordExpiryDays: z.number().int().min(0).max(365).optional(),
  sessionTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
  maxLoginAttempts: z.number().int().min(1).max(10).optional(),
  lockoutDurationMinutes: z.number().int().min(1).max(1440).optional(),
  requireTwoFactor: z.boolean().optional(),
  allowedIPs: z.string().optional(),
  blockedIPs: z.string().optional(),
});

// GET /api/settings/security - Get security settings
export async function GET(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.setting.findMany({
      where: {
        hospitalId,
        category: 'security',
      },
    });

    const securityConfig: any = {};
    settings.forEach((setting) => {
      try {
        securityConfig[setting.key] = JSON.parse(setting.value);
      } catch {
        securityConfig[setting.key] = setting.value;
      }
    });

    return NextResponse.json({
      success: true,
      data: securityConfig,
    });
  } catch (error: any) {
    console.error('Get security settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get security settings' },
      { status: 500 }
    );
  }
}

// POST /api/settings/security - Update security settings
export async function POST(req: NextRequest) {
  const { error, hospitalId } = await requireAuthAndRole(['ADMIN']);
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = securitySettingsSchema.parse(body);

    const updatePromises = Object.entries(data).map(([key, value]) => {
      return prisma.setting.upsert({
        where: {
          hospitalId_key: { key, hospitalId },
        },
        create: {
          key: key,
          value: JSON.stringify(value),
          category: 'security',
          description: `Security setting: ${key}`,
          hospitalId,
        },
        update: {
          value: JSON.stringify(value),
        },
      });
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: 'Security settings updated successfully',
    });
  } catch (error: any) {
    console.error('Update security settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update security settings' },
      { status: 500 }
    );
  }
}
