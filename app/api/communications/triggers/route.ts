import { NextRequest, NextResponse } from 'next/server';
import { communicationTriggersService } from '@/lib/services/communication-triggers.service';

// POST /api/communications/triggers - Run communication triggers
// This endpoint should be called by a cron job (e.g., every hour)
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'your-cron-secret-key';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run all automated communication triggers
    await communicationTriggersService.runAllTriggers();

    return NextResponse.json({
      success: true,
      message: 'Communication triggers executed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Communication triggers error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run communication triggers' },
      { status: 500 }
    );
  }
}

// GET /api/communications/triggers - Manual trigger (for testing)
export async function GET(req: NextRequest) {
  try {
    // Only allow in development or with admin authentication
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Manual triggers not allowed in production' },
        { status: 403 }
      );
    }

    await communicationTriggersService.runAllTriggers();

    return NextResponse.json({
      success: true,
      message: 'Communication triggers executed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Communication triggers error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run communication triggers' },
      { status: 500 }
    );
  }
}
