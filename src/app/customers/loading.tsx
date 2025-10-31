export default function CustomersLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
          <div className="h-4 bg-muted rounded w-64 mt-2 animate-pulse"></div>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
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

      {/* Customers by Router Skeleton */}
      <div className="bg-card rounded-lg border p-6">
        <div className="h-6 bg-muted rounded w-40 mb-2 animate-pulse"></div>
        <div className="h-4 bg-muted rounded w-56 mb-6 animate-pulse"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <div className="h-5 bg-muted rounded w-32 animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-24 mt-2 animate-pulse"></div>
              </div>
              <div className="h-6 bg-muted rounded w-12 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Customers List Skeleton */}
      <div className="bg-card rounded-lg border p-6">
        <div className="h-6 bg-muted rounded w-40 mb-2 animate-pulse"></div>
        <div className="h-4 bg-muted rounded w-56 mb-6 animate-pulse"></div>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-5 bg-muted rounded w-32 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                  <div className="h-1 w-1 bg-muted rounded-full"></div>
                  <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                </div>
              </div>
              <div className="text-right">
                <div className="h-5 bg-muted rounded w-20 mb-1 animate-pulse"></div>
                <div className="h-3 bg-muted rounded w-16 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
