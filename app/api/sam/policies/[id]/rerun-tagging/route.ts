import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Wrap with withAuthTenant manually for dynamic routes
  return withAuthTenant(async (req, { user, tenantId }) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params;
      const policyId = resolvedParams.id;

      // Call suggest-tags endpoint internally
      const suggestTagsUrl = `${req.nextUrl.origin}/api/policies/${policyId}/suggest-tags`;
      const response = await fetch(suggestTagsUrl, {
        method: 'POST',
        headers: {
          'Cookie': req.headers.get('Cookie') || '',
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
  }, { platformKey: 'sam', tenantScoped: true, permissionKey: 'sam.policies.rerun-tagging' })(request);
}
