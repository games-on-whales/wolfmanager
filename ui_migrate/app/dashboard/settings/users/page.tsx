"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, UserPlus, Edit, Trash2, MoreHorizontal, ArrowLeft } from "lucide-react"
import Link from "next/link"

// Sample user data
const INITIAL_USERS = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    role: "Administrator",
    status: "Active",
    lastLogin: "2 hours ago",
  },
  {
    id: 2,
    name: "John Doe",
    email: "john@example.com",
    role: "Standard User",
    status: "Active",
    lastLogin: "Yesterday",
  },
  {
    id: 3,
    name: "Jane Smith",
    email: "jane@example.com",
    role: "Standard User",
    status: "Inactive",
    lastLogin: "3 days ago",
  },
  {
    id: 4,
    name: "Bob Johnson",
    email: "bob@example.com",
    role: "Guest",
    status: "Active",
    lastLogin: "1 week ago",
  },
]

export default function UserManagementPage() {
  const [users, setUsers] = useState(INITIAL_USERS)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Standard User",
    status: "Active",
  })

  // Filter users based on search query
  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleAddUser = () => {
    const id = Math.max(0, ...users.map((u) => u.id)) + 1
    setUsers([...users, { ...newUser, id, lastLogin: "Never" }])
    setNewUser({
      name: "",
      email: "",
      role: "Standard User",
      status: "Active",
    })
    setIsAddUserOpen(false)
  }

  const handleEditUser = () => {
    if (!currentUser) return
    setUsers(users.map((user) => (user.id === currentUser.id ? currentUser : user)))
    setIsEditUserOpen(false)
  }

  const handleDeleteUser = () => {
    if (!currentUser) return
    setUsers(users.filter((user) => user.id !== currentUser.id))
    setIsDeleteUserOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/settings">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white neon-text">User Management</h1>
            <p className="text-gray-400">Add, edit, and manage user accounts</p>
          </div>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-white">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new user account for the streaming platform.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-[#fffb96]">
                  Full Name
                </Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-[#fffb96]">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role" className="text-[#fffb96]">
                  User Role
                </Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
                    <SelectItem value="Administrator">Administrator</SelectItem>
                    <SelectItem value="Standard User">Standard User</SelectItem>
                    <SelectItem value="Guest">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-[#fffb96]">Account Status</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="user-status"
                    checked={newUser.status === "Active"}
                    onCheckedChange={(checked) => setNewUser({ ...newUser, status: checked ? "Active" : "Inactive" })}
                  />
                  <Label htmlFor="user-status" className="text-gray-400">
                    {newUser.status === "Active" ? "Active" : "Inactive"}
                  </Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="border-[rgba(255,255,255,0.1)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]"
                onClick={() => setIsAddUserOpen(false)}
              >
                Cancel
              </Button>
              <Button className="bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-white" onClick={handleAddUser}>
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#01cdfe] pointer-events-none" />
          <Input
            type="search"
            placeholder="Search users by name, email, or role..."
            className="w-full h-10 bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] pl-8 text-white placeholder:text-gray-500 neon-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {filteredUsers.length} users
          </div>
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[180px] bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Administrators</SelectItem>
            <SelectItem value="standard">Standard Users</SelectItem>
            <SelectItem value="guest">Guests</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="glass-card border-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[rgba(255,255,255,0.1)]">
                <TableHead className="text-[#fffb96]">Name</TableHead>
                <TableHead className="text-[#fffb96]">Email</TableHead>
                <TableHead className="text-[#fffb96]">Role</TableHead>
                <TableHead className="text-[#fffb96]">Status</TableHead>
                <TableHead className="text-[#fffb96]">Last Login</TableHead>
                <TableHead className="text-[#fffb96] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-[rgba(255,255,255,0.1)]">
                  <TableCell className="font-medium text-white">{user.name}</TableCell>
                  <TableCell className="text-white">{user.email}</TableCell>
                  <TableCell className="text-white">{user.role}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <div
                        className={`h-2 w-2 rounded-full ${user.status === "Active" ? "bg-[#05ffa1]" : "bg-[#0077B6]"} mr-2`}
                      ></div>
                      <span className={user.status === "Active" ? "text-[#05ffa1]" : "text-[#0077B6]"}>
                        {user.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-400">{user.lastLogin}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white"
                      >
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[rgba(255,255,255,0.1)]" />
                        <DropdownMenuItem
                          className="cursor-pointer hover:bg-[rgba(255,255,255,0.05)]"
                          onClick={() => {
                            setCurrentUser(user)
                            setIsEditUserOpen(true)
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-[#0077B6] hover:bg-[rgba(255,255,255,0.05)]"
                          onClick={() => {
                            setCurrentUser(user)
                            setIsDeleteUserOpen(true)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}

              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-400">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription className="text-gray-400">Update user account information.</DialogDescription>
          </DialogHeader>
          {currentUser && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name" className="text-[#fffb96]">
                  Full Name
                </Label>
                <Input
                  id="edit-name"
                  placeholder="John Doe"
                  className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
                  value={currentUser.name}
                  onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email" className="text-[#fffb96]">
                  Email Address
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="john@example.com"
                  className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
                  value={currentUser.email}
                  onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role" className="text-[#fffb96]">
                  User Role
                </Label>
                <Select
                  value={currentUser.role}
                  onValueChange={(value) => setCurrentUser({ ...currentUser, role: value })}
                >
                  <SelectTrigger className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
                    <SelectItem value="Administrator">Administrator</SelectItem>
                    <SelectItem value="Standard User">Standard User</SelectItem>
                    <SelectItem value="Guest">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-[#fffb96]">Account Status</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-user-status"
                    checked={currentUser.status === "Active"}
                    onCheckedChange={(checked) =>
                      setCurrentUser({ ...currentUser, status: checked ? "Active" : "Inactive" })
                    }
                  />
                  <Label htmlFor="edit-user-status" className="text-gray-400">
                    {currentUser.status === "Active" ? "Active" : "Inactive"}
                  </Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="border-[rgba(255,255,255,0.1)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]"
              onClick={() => setIsEditUserOpen(false)}
            >
              Cancel
            </Button>
            <Button className="bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-white" onClick={handleEditUser}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent className="bg-[rgba(0,0,0,0.8)] backdrop-blur-md border-[rgba(255,255,255,0.1)] text-white">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {currentUser && (
            <div className="py-4">
              <div className="rounded-md bg-[rgba(255,255,255,0.05)] p-4">
                <p className="text-white font-medium">{currentUser.name}</p>
                <p className="text-gray-400">{currentUser.email}</p>
                <p className="text-gray-400">{currentUser.role}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="border-[rgba(255,255,255,0.1)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]"
              onClick={() => setIsDeleteUserOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-[#0077B6] hover:bg-[#0077B6]/80 text-white"
              onClick={handleDeleteUser}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
