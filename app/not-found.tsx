import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>404 - Page Not Found</CardTitle>
          <CardDescription>
            The page you are looking for does not exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button asChild variant="default">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Go to Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

