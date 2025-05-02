"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { GamepadIcon as GameController } from "lucide-react"

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate authentication
    setTimeout(() => {
      setIsLoading(false)
      router.push("/dashboard")
    }, 1000)
  }

  return (
    <Card className="glass-card border-none">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-2">
          <GameController className="h-12 w-12 text-[#00E5CC]" />
        </div>
        <CardTitle className="text-2xl font-bold text-white neon-text">Wolf Game Manager</CardTitle>
        <CardDescription className="text-gray-400">Enter your credentials to access your dashboard</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#fffb96]">
                Email
              </Label>
              <Input
                id="email"
                placeholder="admin@example.com"
                type="email"
                required
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white placeholder:text-gray-500 neon-border"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[#fffb96]">
                  Password
                </Label>
                <Button variant="link" className="px-0 text-xs text-[#01cdfe]">
                  Forgot password?
                </Button>
              </div>
              <Input
                id="password"
                placeholder="••••••••"
                type="password"
                required
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white placeholder:text-gray-500 neon-border"
              />
            </div>
            <Button type="submit" className="w-full bg-[#0077B6] hover:bg-[#0077B6]/80 text-white" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
