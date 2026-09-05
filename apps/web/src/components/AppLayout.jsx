import React from 'react'
import Navbar from './Navbar'
import BottomNav from './BottomNav'

export default function AppLayout({ children, hideNav = false }) {
  if (hideNav) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <Navbar />
      <main className="flex-1 pb-20 md:pb-10">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
