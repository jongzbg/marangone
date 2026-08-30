Frontend Rules:

Layout:
- MUST use MainLayout for all authenticated pages
- MUST reuse Navbar component
- MUST use 3-column layout:
  - Left Sidebar (leaderboards, top creators)
  - Center Content (main page content)
  - Right Sidebar (trending, search)

State Management:
- React Query for server state (API calls, caching)
- React hooks (useState, useEffect) for UI state
- Zustand → TODO: evaluate when app state complexity grows (optional)

UX:
- Infinite scroll for feed
- Optimistic updates for like/repost
- Skeleton loading states

Performance:
- Avoid unnecessary re-renders
- Use memoization (React.memo, useMemo) when needed