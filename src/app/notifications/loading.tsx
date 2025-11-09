export default function NotificationsLoading() {
  return (
    <div className="space-y-6">
      {/* Tabs skeleton */}
      <div className="flex space-x-2 border-b">
        <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
        <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
      </div>

      {/* Filter buttons skeleton */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 bg-muted rounded w-32 animate-pulse"></div>
        <div className="h-9 bg-muted rounded w-28 animate-pulse"></div>
        <div className="h-9 bg-muted rounded w-24 animate-pulse"></div>
        <div className="h-9 bg-muted rounded w-28 animate-pulse"></div>
        <div className="h-9 bg-muted rounded w-24 animate-pulse"></div>
      </div>

      {/* Notifications list skeleton */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                <div className="h-10 w-10 bg-muted rounded-full animate-pulse flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 bg-muted rounded w-48 animate-pulse"></div>
                    <div className="h-4 bg-muted rounded w-16 animate-pulse"></div>
                  </div>
                  <div className="h-4 bg-muted rounded w-full max-w-md animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
                </div>
              </div>
              <div className="h-8 w-8 bg-muted rounded animate-pulse flex-shrink-0"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex justify-between items-center pt-4">
        <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
        <div className="flex gap-2">
          <div className="h-9 bg-muted rounded w-24 animate-pulse"></div>
          <div className="h-9 bg-muted rounded w-24 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
