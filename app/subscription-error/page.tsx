/**
 * Subscription Error Page
 * 
 * Displayed when subscription is expired or blocked
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function SubscriptionErrorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') || 'Subscription is not active';

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <CardTitle>Subscription Required</CardTitle>
          </div>
          <CardDescription>
            Your subscription status prevents access to this platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{reason}</p>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/login')}
              variant="outline"
              className="flex-1"
            >
              Back to Login
            </Button>
            <Button
              onClick={() => router.push('/platforms')}
              variant="default"
              className="flex-1"
            >
              Go to Platforms
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
