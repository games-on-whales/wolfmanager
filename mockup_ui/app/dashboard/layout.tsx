import type { ReactNode } from "react"
import Sidebar from "@/components/sidebar"
import Header from "@/components/header"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="flex flex-col transition-all duration-300 ease-in-out md:ml-16 lg:ml-16">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
