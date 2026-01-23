'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SamGapsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gaps</CardTitle>
          <CardDescription>
            Gap views will be surfaced here. For now, use the Home work queues to create missing drafts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/sam/home">Open work queues</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sam/drafts">Drafts</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

