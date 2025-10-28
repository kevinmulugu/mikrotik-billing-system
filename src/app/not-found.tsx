import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Home, LayoutDashboard, SearchX } from 'lucide-react';

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for does not exist',
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-6">
            {/* Icon and 404 */}
            <div className="flex flex-col items-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <SearchX className="w-10 h-10 text-muted-foreground" />
              </div>
              <h1 className="text-8xl sm:text-9xl font-bold text-muted">404</h1>
            </div>

            {/* Heading and Description */}
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                Page Not Found
              </h2>

              <p className="text-muted-foreground max-w-md mx-auto">
                The page you're looking for doesn't exist or has been moved.
                Let's get you back on track.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button asChild size="lg">
                <Link href="/dashboard">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/">
                  <Home className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}