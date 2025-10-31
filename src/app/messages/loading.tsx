export default function MessagesLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="h-8 bg-muted rounded w-56 animate-pulse"></div>
          <div className="h-4 bg-muted rounded w-80 mt-2 animate-pulse"></div>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-card p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                <div className="h-8 bg-muted rounded w-16 mt-2 animate-pulse"></div>
              </div>
              <div className="h-9 w-9 bg-muted rounded-lg animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Form Skeleton */}
      <div className="bg-card rounded-lg border p-6">
        <div className="h-6 bg-muted rounded w-40 mb-2 animate-pulse"></div>
        <div className="h-4 bg-muted rounded w-64 mb-6 animate-pulse"></div>
        <div className="space-y-6">
          <div>
            <div className="h-4 bg-muted rounded w-32 mb-3 animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-10 bg-muted rounded animate-pulse"></div>
              <div className="h-10 bg-muted rounded animate-pulse"></div>
            </div>
          </div>
          <div>
            <div className="h-4 bg-muted rounded w-24 mb-3 animate-pulse"></div>
            <div className="h-32 bg-muted rounded animate-pulse"></div>
          </div>
          <div className="h-10 bg-muted rounded w-full animate-pulse"></div>
        </div>
      </div>

      {/* Info Card Skeleton */}
      <div className="bg-card rounded-lg border p-6">
        <div className="h-6 bg-muted rounded w-32 mb-4 animate-pulse"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-6 w-6 bg-muted rounded-full animate-pulse shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
                <div className="h-3 bg-muted rounded w-full animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
