import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SignUpLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-2">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-2/3 mx-auto" />
        </CardHeader>

        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />

          <div className="relative">
            <Skeleton className="h-px w-full" />
          </div>

          <div className="space-y-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>

          <Skeleton className="h-4 w-2/3 mx-auto" />
        </CardContent>
      </Card>
    </div>
  );
}