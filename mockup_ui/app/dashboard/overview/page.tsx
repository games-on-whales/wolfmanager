import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HardDrive, Users, Gamepad2, Clock } from "lucide-react"

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-300">Active Sessions</CardTitle>
            <Users className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">3</div>
            <p className="text-xs text-gray-400">+2 from yesterday</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-300">Games Installed</CardTitle>
            <Gamepad2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">28</div>
            <p className="text-xs text-gray-400">+3 this week</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-300">Storage Used</CardTitle>
            <HardDrive className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">1.2 TB</div>
            <p className="text-xs text-gray-400">of 2 TB (60%)</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-300">Uptime</CardTitle>
            <Clock className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">6d 14h</div>
            <p className="text-xs text-gray-400">Since last restart</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-gray-400">Latest actions on your server</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { user: "John Doe", action: "Started Cyberpunk 2077", time: "10 minutes ago" },
                { user: "Alice Smith", action: "Installed Elden Ring", time: "2 hours ago" },
                { user: "Bob Johnson", action: "Paired new device 'Living Room'", time: "Yesterday" },
                { user: "Sarah Williams", action: "Updated system settings", time: "2 days ago" },
              ].map((item, i) => (
                <div key={i} className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{item.action}</p>
                    <p className="text-xs text-gray-400">by {item.user}</p>
                  </div>
                  <div className="text-xs text-gray-500">{item.time}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">System Status</CardTitle>
            <CardDescription className="text-gray-400">Current resource usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "CPU Usage", value: "32%" },
                { name: "Memory Usage", value: "5.4 GB / 16 GB" },
                { name: "Network", value: "24 Mbps Down / 12 Mbps Up" },
                { name: "Temperature", value: "58°C" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-sm text-gray-300">{item.name}</p>
                  <p className="text-sm font-medium text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
