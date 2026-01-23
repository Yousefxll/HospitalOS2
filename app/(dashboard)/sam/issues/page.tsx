'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SamIssuesPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Issues</CardTitle>
          <CardDescription>
            Issues view will be wired to integrity runs/findings. For now, use Conflicts and the Library run actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/sam/library">Open library</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sam/conflicts">Open conflicts</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

