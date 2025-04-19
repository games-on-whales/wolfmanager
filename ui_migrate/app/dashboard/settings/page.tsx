"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Search, User, History, FileText, Code } from "lucide-react"

export default function SettingsPage() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white neon-text">Settings</h1>
          <p className="text-gray-400">Manage your game streaming server preferences</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#01cdfe] pointer-events-none" />
          <Input
            type="search"
            placeholder="Find settings..."
            className="w-full h-10 bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] pl-8 text-white placeholder:text-gray-500 neon-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Separator className="bg-[rgba(255,255,255,0.1)]" />

      <h2 className="text-xl font-bold text-white">Account Settings</h2>
      <p className="text-gray-400">Settings for your account</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card border-none">
          <CardHeader className="flex flex-row items-start space-y-0 gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
              <User className="h-5 w-5 text-[#00E5CC]" />
            </div>
            <div>
              <CardTitle className="text-white">Account</CardTitle>
              <CardDescription className="text-gray-400">Configure your account settings</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white">
              Manage Account
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-none">
          <CardHeader className="flex flex-row items-start space-y-0 gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
              <History className="h-5 w-5 text-[#01cdfe]" />
            </div>
            <div>
              <CardTitle className="text-white">Sessions</CardTitle>
              <CardDescription className="text-gray-400">View and manage your active sessions</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white">
              View Sessions
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator className="bg-[rgba(255,255,255,0.1)]" />

      <h2 className="text-xl font-bold text-white">Admin Settings</h2>
      <p className="text-gray-400">Advanced settings for administrators</p>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass-card border-none">
          <CardHeader className="flex flex-row items-start space-y-0 gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
              <Users className="h-5 w-5 text-[#05ffa1]" />
            </div>
            <div>
              <CardTitle className="text-white">User Management</CardTitle>
              <CardDescription className="text-gray-400">Manage system users and permissions</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white"
              onClick={() => (window.location.href = "/dashboard/settings/users")}
            >
              Manage Users
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-none">
          <CardHeader className="flex flex-row items-start space-y-0 gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
              <FileText className="h-5 w-5 text-[#fffb96]" />
            </div>
            <div>
              <CardTitle className="text-white">System Logs</CardTitle>
              <CardDescription className="text-gray-400">View and analyze system logs</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white">
              View Logs
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border-none">
          <CardHeader className="flex flex-row items-start space-y-0 gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
              <Code className="h-5 w-5 text-[#0077B6]" />
            </div>
            <div>
              <CardTitle className="text-white">API Test</CardTitle>
              <CardDescription className="text-gray-400">Test and verify API endpoints</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] text-white">
              Test API
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator className="bg-[rgba(255,255,255,0.1)]" />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-[rgba(0,0,0,0.3)]">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-[rgba(255,255,255,0.1)] data-[state=active]:text-[#01cdfe]"
          >
            General
          </TabsTrigger>
          <TabsTrigger
            value="streaming"
            className="data-[state=active]:bg-[rgba(255,255,255,0.1)] data-[state=active]:text-[#01cdfe]"
          >
            Streaming
          </TabsTrigger>
          <TabsTrigger
            value="storage"
            className="data-[state=active]:bg-[rgba(255,255,255,0.1)] data-[state=active]:text-[#01cdfe]"
          >
            Storage
          </TabsTrigger>
          <TabsTrigger
            value="advanced"
            className="data-[state=active]:bg-[rgba(255,255,255,0.1)] data-[state=active]:text-[#01cdfe]"
          >
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <div className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="server-name" className="text-[#fffb96]">
                Server Name
              </Label>
              <Input
                id="server-name"
                defaultValue="Home Gaming Server"
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="server-location" className="text-[#fffb96]">
                Server Location
              </Label>
              <Select defaultValue="living-room">
                <SelectTrigger className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
                  <SelectItem value="living-room">Living Room</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="basement">Basement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="text-[#fffb96]">Auto-Start on Boot</Label>
              <div className="flex items-center space-x-2">
                <Switch id="auto-start" defaultChecked />
                <Label htmlFor="auto-start" className="text-gray-400">
                  Start server automatically when system boots
                </Label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-[#fffb96]">Automatic Updates</Label>
              <div className="flex items-center space-x-2">
                <Switch id="auto-updates" defaultChecked />
                <Label htmlFor="auto-updates" className="text-gray-400">
                  Download and install updates automatically
                </Label>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="streaming" className="mt-6">
          <div className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="resolution" className="text-[#fffb96]">
                Default Resolution
              </Label>
              <Select defaultValue="1080p">
                <SelectTrigger className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border">
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="1440p">1440p</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bitrate" className="text-[#fffb96]">
                Maximum Bitrate
              </Label>
              <Select defaultValue="20">
                <SelectTrigger className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border">
                  <SelectValue placeholder="Select bitrate" />
                </SelectTrigger>
                <SelectContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
                  <SelectItem value="10">10 Mbps</SelectItem>
                  <SelectItem value="20">20 Mbps</SelectItem>
                  <SelectItem value="30">30 Mbps</SelectItem>
                  <SelectItem value="50">50 Mbps</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="codec" className="text-[#fffb96]">
                Video Codec
              </Label>
              <Select defaultValue="h265">
                <SelectTrigger className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border">
                  <SelectValue placeholder="Select codec" />
                </SelectTrigger>
                <SelectContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
                  <SelectItem value="h264">H.264 (AVC)</SelectItem>
                  <SelectItem value="h265">H.265 (HEVC)</SelectItem>
                  <SelectItem value="av1">AV1</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="text-[#fffb96]">Hardware Acceleration</Label>
              <div className="flex items-center space-x-2">
                <Switch id="hw-accel" defaultChecked />
                <Label htmlFor="hw-accel" className="text-gray-400">
                  Use GPU for encoding/decoding
                </Label>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="storage" className="mt-6">
          <div className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="storage-path" className="text-[#fffb96]">
                Game Storage Location
              </Label>
              <Input
                id="storage-path"
                defaultValue="D:/GameLibrary"
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[#fffb96]">Storage Usage</Label>
              <div className="h-4 w-full bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                <div className="bg-[#01cdfe] h-full" style={{ width: "60%" }}></div>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>1.2 TB used</span>
                <span>2 TB total</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-[#fffb96]">Auto-Delete Unused Games</Label>
              <div className="flex items-center space-x-2">
                <Switch id="auto-delete" />
                <Label htmlFor="auto-delete" className="text-gray-400">
                  Automatically remove games not played in 90 days
                </Label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-[#fffb96]">Compress Game Files</Label>
              <div className="flex items-center space-x-2">
                <Switch id="compress" defaultChecked />
                <Label htmlFor="compress" className="text-gray-400">
                  Use compression to save disk space
                </Label>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="mt-6">
          <div className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="port" className="text-[#fffb96]">
                Server Port
              </Label>
              <Input
                id="port"
                defaultValue="8080"
                className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[#fffb96]">Enable Remote Access</Label>
              <div className="flex items-center space-x-2">
                <Switch id="remote-access" defaultChecked />
                <Label htmlFor="remote-access" className="text-gray-400">
                  Allow connections from outside your local network
                </Label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-[#fffb96]">Debug Mode</Label>
              <div className="flex items-center space-x-2">
                <Switch id="debug-mode" />
                <Label htmlFor="debug-mode" className="text-gray-400">
                  Enable detailed logging for troubleshooting
                </Label>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-[#fffb96]">Factory Reset</Label>
              <Button variant="destructive" className="bg-[#0077B6] hover:bg-[#0077B6]/80">
                Reset All Settings
              </Button>
              <p className="text-xs text-gray-400">
                This will reset all settings to default values but won't delete your game library.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-4">
        <Button
          variant="outline"
          className="border-[rgba(255,255,255,0.1)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)] neon-border"
        >
          Cancel
        </Button>
        <Button className="bg-[#0077B6] hover:bg-[#0077B6]/80 text-white">Save Changes</Button>
      </div>
    </div>
  )
}
