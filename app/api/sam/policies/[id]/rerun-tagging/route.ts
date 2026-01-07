import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const policyId = params.id;

    // Call suggest-tags endpoint internally
    const suggestTagsUrl = `${request.nextUrl.origin}/api/policies/${policyId}/suggest-tags`;
    const response = await fetch(suggestTagsUrl, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        aiTags: data.aiTags,
        tagsStatus: data.tagsStatus,
      });
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Failed to re-run tagging' }));
      return NextResponse.json(
        { error: errorData.error || 'Failed to re-run tagging' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Re-run tagging error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
