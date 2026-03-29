// src/app/messages/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function MessagesLoading() {
  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-8 rounded-md" />
        ))}
      </div>

      {/* Send form card */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recipient selector */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-52" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Template selector */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Message textarea */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-[120px] w-full rounded-md" />
            <Skeleton className="h-3 w-64" />
          </div>

          {/* Submit button */}
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}
