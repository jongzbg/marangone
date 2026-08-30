// Skeleton loading components for all pages

export function PostSkeleton() {
  return (
    <div className="p-4 border-b border-border animate-pulse">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-surface-elevated flex-shrink-0" />
        <div className="flex-1 space-y-2">
          {/* Header: name + time */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 bg-surface-elevated rounded" />
            <div className="h-3 w-16 bg-surface-elevated rounded" />
          </div>
          {/* Content */}
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-surface-elevated rounded" />
            <div className="h-3 w-3/4 bg-surface-elevated rounded" />
          </div>
          {/* Actions */}
          <div className="flex items-center gap-6 pt-2">
            <div className="h-4 w-16 bg-surface-elevated rounded" />
            <div className="h-4 w-16 bg-surface-elevated rounded" />
            <div className="h-4 w-16 bg-surface-elevated rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Banner */}
      <div className="h-32 bg-surface-elevated" />
      {/* Info section */}
      <div className="px-4 pb-4">
        <div className="flex justify-between items-end -mt-12 mb-4">
          <div className="w-24 h-24 rounded-full bg-surface-base border-4 border-black" />
          <div className="h-9 w-24 bg-surface-elevated rounded-full" />
        </div>
        {/* Name + username */}
        <div className="space-y-1.5 mb-3">
          <div className="h-5 w-32 bg-surface-elevated rounded" />
          <div className="h-4 w-20 bg-surface-elevated rounded" />
        </div>
        {/* Bio */}
        <div className="space-y-1 mb-3">
          <div className="h-4 w-full bg-surface-elevated rounded" />
          <div className="h-4 w-2/3 bg-surface-elevated rounded" />
        </div>
        {/* Stats */}
        <div className="flex gap-4">
          <div className="h-4 w-16 bg-surface-elevated rounded" />
          <div className="h-4 w-16 bg-surface-elevated rounded" />
        </div>
      </div>
    </div>
  )
}

export function PostComposerSkeleton() {
  return (
    <div className="p-4 border-b border-border animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-elevated flex-shrink-0" />
        <div className="flex-1">
          <div className="h-16 bg-surface-elevated rounded-2xl" />
          <div className="flex justify-between items-center mt-3">
            <div className="h-8 w-8 bg-surface-elevated rounded-full" />
            <div className="h-9 w-20 bg-surface-elevated rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConversationSkeleton() {
  return (
    <div className="p-4 flex items-center gap-3 animate-pulse">
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-surface-elevated flex-shrink-0" />
      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <div className="h-4 w-24 bg-surface-elevated rounded" />
          <div className="h-3 w-12 bg-surface-elevated rounded" />
        </div>
        <div className="h-3 w-40 bg-surface-elevated rounded" />
      </div>
    </div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center gap-3 px-4">
        <div className="w-8 h-8 rounded-full bg-surface-elevated animate-pulse" />
        <div className="h-4 w-24 bg-surface-elevated rounded animate-pulse" />
      </div>
      {/* Messages */}
      <div className="flex-1 p-4 space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-surface-elevated animate-pulse flex-shrink-0" />
            <div className={`h-16 ${i % 2 === 0 ? 'w-48' : 'w-64'} bg-surface-elevated rounded-2xl animate-pulse`} />
          </div>
        ))}
      </div>
      {/* Input */}
      <div className="h-14 border-t border-border flex items-center gap-2 px-4">
        <div className="flex-1 h-10 bg-surface-elevated rounded-full animate-pulse" />
        <div className="w-10 h-10 bg-surface-elevated rounded-full animate-pulse" />
      </div>
    </div>
  )
}

export function NotificationSkeleton() {
  return (
    <div className="p-4 flex items-start gap-3 animate-pulse border-b border-border">
      <div className="w-10 h-10 rounded-full bg-surface-elevated flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-4 w-32 bg-surface-elevated rounded" />
          <div className="w-2 h-2 rounded-full bg-surface-elevated" />
        </div>
        <div className="h-3 w-48 bg-surface-elevated rounded" />
      </div>
    </div>
  )
}

export function SearchResultSkeleton() {
  return (
    <div className="p-4 flex items-center gap-3 animate-pulse border-b border-border">
      <div className="w-10 h-10 rounded-full bg-surface-elevated flex-shrink-0" />
      <div className="flex-1">
        <div className="h-4 w-24 bg-surface-elevated rounded mb-1" />
        <div className="h-3 w-16 bg-surface-elevated rounded" />
      </div>
    </div>
  )
}

export function EditProfileSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Banner */}
      <div className="h-32 bg-surface-elevated" />
      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full bg-surface-base border-4 border-black -mt-12 mb-4" />
        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <div className="h-3 w-16 bg-surface-elevated rounded mb-1" />
            <div className="h-10 w-full bg-surface-elevated rounded-lg" />
          </div>
          <div>
            <div className="h-3 w-16 bg-surface-elevated rounded mb-1" />
            <div className="h-10 w-full bg-surface-elevated rounded-lg" />
          </div>
          <div>
            <div className="h-3 w-16 bg-surface-elevated rounded mb-1" />
            <div className="h-24 w-full bg-surface-elevated rounded-lg" />
          </div>
          <div className="h-10 w-full bg-surface-elevated rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// Simple skeleton for generic loading states
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-surface-elevated rounded animate-pulse ${className}`} />
}