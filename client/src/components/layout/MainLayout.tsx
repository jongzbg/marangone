'use client'

import { ReactNode } from 'react'
import Header from './Header'
import LeftSidebar from './LeftSidebar'
import RightSidebar from './RightSidebar'
import BottomNav from './BottomNav'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <>
      {/* Fixed Header */}
      <Header />

      {/* Main Content — 3-column centered */}
      <main className="pt-16 max-w-[1300px] mx-auto flex justify-center min-h-screen">
        {/* Left Sidebar */}
        <LeftSidebar />

        {/* Center Feed */}
        <div className="w-full max-w-[600px] border-x border-border min-h-screen bg-black">
          {children}
        </div>

        {/* Right Sidebar */}
        <RightSidebar />
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />
    </>
  )
}