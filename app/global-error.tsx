'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global application error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-red-600">Something went wrong!</CardTitle>
              <CardDescription>
                A critical error occurred in the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {process.env.NODE_ENV === 'development' && (
                  <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-3 rounded">
                    {error.message}
                  </pre>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={reset} variant="default">
                  Try again
                </Button>
                <Button onClick={() => window.location.href = '/'} variant="outline">
                  Go to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  )
}

