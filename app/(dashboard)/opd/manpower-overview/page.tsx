'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ManpowerOverviewPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold">OPD Manpower Overview</h1>
        <p className="text-muted-foreground">View-only dashboard (legacy)</p>
      </div>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            New Editable Version Available
          </CardTitle>
          <CardDescription>
            A new fully-editable manpower management page is now available with inline editing,
            side panels for complex data, and improved workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/opd/manpower-edit')} className="w-full md:w-auto h-11">
            Go to New Manpower Editor
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Legacy View</CardTitle>
          <CardDescription>
            This page is being phased out. Please use the new editable version above.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          <p>
            The new manpower management page includes:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Inline editing for names, IDs, and status toggles</li>
            <li>Side panel editors for doctor schedules and nurse assignments</li>
            <li>Workforce calculator for staffing requirements</li>
            <li>Add/Edit/Delete functionality for all entities</li>
            <li>Real-time data persistence to database</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
