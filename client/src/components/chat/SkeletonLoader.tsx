// Shimmer skeleton for the conversations list

export default function SkeletonLoader() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-4 flex items-center gap-3 animate-pulse">
          {/* Avatar circle */}
          <div className="w-12 h-12 rounded-full bg-surface-elevated flex-shrink-0" />
          {/* Text lines */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="h-4 w-28 bg-surface-elevated rounded" />
              <div className="h-3 w-12 bg-surface-elevated rounded" />
            </div>
            <div className="h-3 w-44 bg-surface-elevated rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
