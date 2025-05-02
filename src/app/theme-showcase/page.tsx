"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Info,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeShowcase() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine if we should use the light theme variant - using resolvedTheme to handle system preference
  const isLightTheme = mounted && resolvedTheme === "light";

  return (
    <div className="min-h-screen bg-background p-4 wolf-theme">
      <div className="container mx-auto py-8 space-y-12">
        <header className="text-center mb-8 relative">
          <div className="absolute right-0 top-0 z-10">
            <div className="p-2 bg-card/80 backdrop-blur-sm rounded-lg shadow-lg">
              <ThemeToggle />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 gradient-text">
            Wolf Manager Theme Showcase
          </h1>
          <p className="text-muted-foreground text-lg">
            A comprehensive display of UI components with the Wolf theme
          </p>
          <div className="flex items-center justify-center mt-4 gap-2">
            <Sun className="h-5 w-5" />
            <div className="font-medium">
              Currently viewing: {isLightTheme ? "Light" : "Dark"} theme
            </div>
            <Moon className="h-5 w-5" />
          </div>
        </header>

        {/* Theme Overview */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Theme Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-card border-none p-6">
              <CardHeader>
                <CardTitle>Primary Colors</CardTitle>
                <CardDescription>Main color scheme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="bg-primary h-12 rounded-md flex items-center justify-center text-primary-foreground font-medium">
                    Primary
                  </div>
                  <div className="bg-secondary h-12 rounded-md flex items-center justify-center text-secondary-foreground font-medium">
                    Secondary
                  </div>
                  <div className="bg-muted h-12 rounded-md flex items-center justify-center text-muted-foreground font-medium">
                    Muted
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-none p-6">
              <CardHeader>
                <CardTitle>Backgrounds</CardTitle>
                <CardDescription>Surface and background colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="bg-background h-12 rounded-md flex items-center justify-center text-foreground font-medium border border-border">
                    Background
                  </div>
                  <div className="bg-card h-12 rounded-md flex items-center justify-center text-card-foreground font-medium">
                    Card
                  </div>
                  <div className="bg-popover h-12 rounded-md flex items-center justify-center text-popover-foreground font-medium">
                    Popover
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-none p-6">
              <CardHeader>
                <CardTitle>Status Colors</CardTitle>
                <CardDescription>Colors for different states</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="bg-green-500 h-12 rounded-md flex items-center justify-center text-white font-medium">
                    Success
                  </div>
                  <div className="bg-blue-500 h-12 rounded-md flex items-center justify-center text-white font-medium">
                    Info
                  </div>
                  <div className="bg-yellow-500 h-12 rounded-md flex items-center justify-center text-white font-medium">
                    Warning
                  </div>
                  <div className="bg-destructive h-12 rounded-md flex items-center justify-center text-destructive-foreground font-medium">
                    Destructive
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Buttons</h2>
          <Card className="glass-card border-none p-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Destructive</Button>
                <Button disabled>Disabled</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Form Elements */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Form Elements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-card border-none p-6">
              <CardHeader>
                <CardTitle>Inputs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="default-input">Default Input</Label>
                  <Input
                    id="default-input"
                    placeholder="Type something..."
                    className="wolf-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disabled-input">Disabled Input</Label>
                  <Input
                    id="disabled-input"
                    placeholder="Disabled"
                    disabled
                    className="wolf-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="search-input">Search Input</Label>
                  <div className="relative">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <Input
                      id="search-input"
                      className="pl-8 wolf-input"
                      placeholder="Search..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-input">
                    Custom Styled Input (Wolf)
                  </Label>
                  <Input
                    id="custom-input"
                    className="wolf-input"
                    placeholder="Wolf styled input..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-none p-6">
              <CardHeader>
                <CardTitle>Select & Switch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="default-select">Default Select</Label>
                  <Select>
                    <SelectTrigger
                      id="default-select"
                      className="wolf-dropdown"
                    >
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                      <SelectItem value="option3">Option 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disabled-select">Disabled Select</Label>
                  <Select disabled>
                    <SelectTrigger
                      id="disabled-select"
                      className="wolf-dropdown"
                    >
                      <SelectValue placeholder="Disabled" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4 pt-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="switch1" />
                    <Label htmlFor="switch1">Enable notifications</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="switch2" defaultChecked />
                    <Label htmlFor="switch2">Dark mode</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Dropdowns & Expandable Menu */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">
            Dropdowns & Expandable Menu
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Dropdown Menu</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span>Open Menu</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="wolf-menu-item">
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="wolf-menu-item">
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem className="wolf-menu-item">
                      Games
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive wolf-menu-item">
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="wolf-dropdown flex items-center justify-between px-4 py-2">
                  <span>Custom Dropdown (Non-functional)</span>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expandable Menu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="wolf-expandable-menu">
                  <div
                    className="wolf-expandable-header"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>Advanced Settings</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>
                  {isExpanded && (
                    <div className="wolf-expandable-content">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Switch id="expandedSwitch1" />
                          <Label htmlFor="expandedSwitch1">Debug Mode</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="expandedSwitch2" />
                          <Label htmlFor="expandedSwitch2">
                            Developer Options
                          </Label>
                        </div>
                        <div className="pt-2">
                          <Button size="sm" variant="outline">
                            Apply Settings
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Notifications & Alerts */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Notifications</h2>
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Styles</CardTitle>
                <CardDescription>
                  Different notification styles for various message types
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="wolf-notification wolf-notification-info p-4">
                  <div className="flex items-start">
                    <Info className="h-5 w-5 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Information</h4>
                      <p className="text-sm text-muted-foreground">
                        There are 3 new game updates available for your library.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="wolf-notification wolf-notification-success p-4">
                  <div className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Success</h4>
                      <p className="text-sm text-muted-foreground">
                        Game installation completed successfully.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="wolf-notification wolf-notification-warning p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Warning</h4>
                      <p className="text-sm text-muted-foreground">
                        Low disk space detected. Some game installations may
                        fail.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="wolf-notification wolf-notification-error p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Error</h4>
                      <p className="text-sm text-muted-foreground">
                        Failed to connect to game server. Check your network
                        connection.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Tabs and Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Tabs and Cards</h2>
          <Card>
            <CardHeader>
              <CardTitle>Navigation Tabs</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="games" className="w-full">
                <TabsList className="grid w-full grid-cols-4 p-1 wolf-tabs">
                  <TabsTrigger value="games" className="wolf-tab">
                    Games
                  </TabsTrigger>
                  <TabsTrigger value="users" className="wolf-tab">
                    Users
                  </TabsTrigger>
                  <TabsTrigger value="logs" className="wolf-tab">
                    Logs
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="wolf-tab">
                    Settings
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="games" className="py-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-0">
                        <div className="aspect-video bg-muted rounded-t-md relative overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center">
                            Game Cover 1
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold">DOOM</h3>
                          <p className="text-sm text-muted-foreground">
                            First Person Shooter
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-0">
                        <div className="aspect-video bg-muted rounded-t-md relative overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center">
                            Game Cover 2
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold">Duke Nukem</h3>
                          <p className="text-sm text-muted-foreground">
                            First Person Shooter
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-0">
                        <div className="aspect-video bg-muted rounded-t-md relative overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center">
                            Game Cover 3
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold">Elite: Dangerous</h3>
                          <p className="text-sm text-muted-foreground">
                            Space Simulation
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                <TabsContent value="users" className="py-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">salty2011</TableCell>
                        <TableCell>
                          <Badge className="bg-green-500">Online</Badge>
                        </TableCell>
                        <TableCell>Admin</TableCell>
                        <TableCell>Now</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">user2</TableCell>
                        <TableCell>
                          <Badge variant="outline">Offline</Badge>
                        </TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>2 days ago</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">user3</TableCell>
                        <TableCell>
                          <Badge variant="outline">Offline</Badge>
                        </TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>5 days ago</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="logs" className="py-4">
                  <div className="space-y-2">
                    <div className="wolf-notification wolf-notification-info p-3">
                      <div className="flex gap-2">
                        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">
                              Today, 02:51:07
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Server
                            </Badge>
                          </div>
                          <p className="text-sm">
                            Sending config to client (sensitive data redacted)
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="wolf-notification wolf-notification-warning p-3">
                      <div className="flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">
                              Today, 02:45:12
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Steam API
                            </Badge>
                          </div>
                          <p className="text-sm">
                            Rate limit approaching, slowing down requests
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="wolf-notification p-3">
                      <div className="flex gap-2">
                        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">
                              Today, 02:30:45
                            </span>
                            <Badge variant="outline" className="text-xs">
                              System
                            </Badge>
                          </div>
                          <p className="text-sm">User salty2011 logged in</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="settings" className="py-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select defaultValue="en">
                        <SelectTrigger id="language" className="wolf-dropdown">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setting1">Cache Directory</Label>
                      <div className="flex gap-2">
                        <Input
                          id="setting1"
                          value="/config/cache/artwork"
                          readOnly
                          className="flex-1"
                        />
                        <Button variant="outline" size="icon">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="w-5 h-5"
                          >
                            <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                            <path
                              fillRule="evenodd"
                              d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setting2">Debug Mode</Label>
                      <div className="flex items-center space-x-2">
                        <Switch id="setting2" defaultChecked />
                        <span className="text-sm text-muted-foreground">
                          Enabled
                        </span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>

        {/* Dialog */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Dialog/Modal</h2>
          <Card>
            <CardContent className="pt-6">
              <Button onClick={() => setIsDialogOpen(true)}>Open Dialog</Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Game</DialogTitle>
                    <DialogDescription>
                      Make changes to the game settings here.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-foreground">
                        Game Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter game name"
                        defaultValue="DOOM"
                        className="wolf-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="path" className="text-foreground">
                        Installation Path
                      </Label>
                      <Input
                        id="path"
                        placeholder="Enter installation path"
                        defaultValue="/games/doom"
                        className="wolf-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="game-type" className="text-foreground">
                        Game Type
                      </Label>
                      <Select defaultValue="fps">
                        <SelectTrigger id="game-type" className="wolf-dropdown">
                          <SelectValue placeholder="Select game type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fps">
                            First Person Shooter
                          </SelectItem>
                          <SelectItem value="rpg">Role Playing Game</SelectItem>
                          <SelectItem value="strategy">Strategy</SelectItem>
                          <SelectItem value="simulation">Simulation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={() => setIsDialogOpen(false)}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </section>

        {/* New color showcases */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">UI Element Colors</h2>
          <Card>
            <CardHeader>
              <CardTitle>UI Element Colors</CardTitle>
              <CardDescription>
                Colors for different UI components
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="bg-[hsl(var(--form-bg))] h-12 rounded-md flex items-center justify-center text-foreground font-medium">
                  Form Background
                </div>
                <div className="bg-[hsl(var(--tab-active))] h-12 rounded-md flex items-center justify-center text-primary-foreground font-medium">
                  Active Tab
                </div>
                <div className="bg-[hsl(var(--tab-inactive))] h-12 rounded-md flex items-center justify-center text-foreground/80 font-medium">
                  Inactive Tab
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
