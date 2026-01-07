import { Suspense } from 'react';
import NewPolicyFromScratchClient from './Client';

export default function NewPolicyFromScratchPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-2"></div>
          <div className="h-4 bg-muted rounded w-96"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-muted rounded"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    }>
      <NewPolicyFromScratchClient />
    </Suspense>
  );
}
