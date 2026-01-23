'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SamAssistantPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assistant</CardTitle>
          <CardDescription>
            SAM assistant UI will live here. For now, use Library and Drafts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/sam/library">Library</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sam/drafts">Drafts</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

