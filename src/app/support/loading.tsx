export default function SupportLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-64 mt-2 animate-pulse"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-16 mt-2 animate-pulse"></div>
              </div>
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Cards Skeleton */}
      <div className="grid md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center">
              <div className="h-12 w-12 bg-gray-200 rounded mx-auto mb-4 animate-pulse"></div>
              <div className="h-6 bg-gray-200 rounded w-32 mx-auto mb-4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-40 mx-auto mb-4 animate-pulse"></div>
              <div className="h-6 bg-gray-200 rounded w-20 mx-auto animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Tickets Skeleton */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    </div>
  );
}