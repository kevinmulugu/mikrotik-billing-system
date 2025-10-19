export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-64 mt-2 animate-pulse"></div>
      </div>

      {/* Settings Grid Skeleton */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center">
              <div className="h-12 w-12 bg-gray-200 rounded mx-auto mb-4 animate-pulse"></div>
              <div className="h-6 bg-gray-200 rounded w-32 mx-auto mb-4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-40 mx-auto mb-4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-28 mx-auto animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Settings Skeleton */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b">
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-40 mt-1 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                      <div className="h-3 bg-gray-200 rounded w-40 mt-1 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}