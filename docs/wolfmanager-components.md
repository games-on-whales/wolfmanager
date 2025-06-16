# WolfManager Component System

A comprehensive set of reusable components that automatically apply WolfManager styling patterns for consistent design across the application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Layout Components](#layout-components)
3. [Button Components](#button-components)
4. [Data Table Components](#data-table-components)
5. [Page Templates](#page-templates)
6. [Migration Guide](#migration-guide)
7. [Examples](#examples)

---

## Quick Start

Import components from the centralized WolfUI package:

```tsx
import { 
  WolfPageLayout, 
  WolfContentCard, 
  ManagementPageTemplate,
  AddButton,
  WolfDataTable 
} from "@/components/wolf-ui";
```

### Before vs After

**Before (Manual Styling):**
```tsx
export default function UsersPage() {
  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-white neon-text">Users</h1>
      </div>
      {/* Manual table implementation... */}
    </div>
  );
}
```

**After (WolfUI Components):**
```tsx
export default function UsersPage() {
  return (
    <ManagementPageTemplate
      title="User Management"
      backHref="/settings"
      data={users}
      columns={userColumns}
      addButtonText="Add User"
      onAdd={() => setShowAddModal(true)}
      onRefresh={fetchUsers}
    />
  );
}
```

---

## Layout Components

### WolfPageLayout

Standard page container with consistent spacing, header, and optional back button.

```tsx
<WolfPageLayout
  title="Page Title"
  description="Optional description"
  backHref="/previous-page"
  actions={<AddButton onClick={handleAdd} />}
>
  {/* Page content */}
</WolfPageLayout>
```

**Props:**
- `title` (string): Page title with automatic neon-text styling
- `description?` (string): Optional subtitle in gray-400
- `backHref?` (string): Optional back button navigation
- `actions?` (ReactNode): Action buttons in the header
- `className?` (string): Additional CSS classes

### WolfContentCard

Glass-card container for content sections with consistent styling.

```tsx
<WolfContentCard
  title="Section Title"
  description="Section description"
  actions={<RefreshButton onClick={handleRefresh} />}
>
  {/* Card content */}
</WolfContentCard>
```

**Props:**
- `title?` (string): Card title in white
- `description?` (string): Card description in gray-400
- `actions?` (ReactNode): Action buttons in the header
- `className?` (string): Additional CSS classes for the card
- `headerClassName?` (string): Additional CSS classes for the header
- `contentClassName?` (string): Additional CSS classes for the content

---

## Button Components

### ActionButton

Primary action buttons with `variant="outline" size="sm"` styling.

```tsx
<ActionButton onClick={handleAction}>
  Action Text
</ActionButton>
```

### IconButton

Icon-only buttons with `variant="ghost" size="icon"` styling.

```tsx
<IconButton onClick={handleEdit}>
  <Edit className="h-4 w-4" />
</IconButton>
```

### Specialized Buttons

```tsx
// Back navigation
<BackButton href="/previous-page" />

// Add actions
<AddButton text="Add User" onClick={handleAdd} />

// Refresh actions
<RefreshButton onClick={handleRefresh} />

// Edit actions
<EditButton onClick={handleEdit} />

// View actions
<ViewButton onClick={handleView} />

// Delete actions (with red styling)
<DeleteButton onClick={handleDelete} />
```

---

## Data Table Components

### WolfDataTable

Fully styled data table with loading states, empty states, and consistent styling.

```tsx
const columns = [
  {
    key: 'name',
    header: 'Name',
    render: (user) => <span className="font-medium">{user.name}</span>
  },
  {
    key: 'email',
    header: 'Email'
  },
  {
    key: 'status',
    header: 'Status',
    render: (user) => <StatusBadge status={user.status} variant="success" />
  },
  {
    key: 'actions',
    header: 'Actions',
    render: (user) => (
      <TableActions>
        <EditButton onClick={() => handleEdit(user)} />
        <DeleteButton onClick={() => handleDelete(user)} />
      </TableActions>
    )
  }
];

<WolfDataTable
  title="Users"
  description="Manage user accounts"
  data={users}
  columns={columns}
  actions={<AddButton text="Add User" onClick={handleAdd} />}
  isLoading={isLoading}
  emptyMessage="No users found"
  onRowClick={handleRowClick}
/>
```

**Props:**
- `title?` (string): Table title
- `description?` (string): Table description
- `data` (T[]): Array of data objects
- `columns` (Column<T>[]): Column definitions
- `actions?` (ReactNode): Header action buttons
- `isLoading?` (boolean): Loading state
- `emptyMessage?` (string): Message when no data
- `onRowClick?` (function): Row click handler

### TableActions

Container for action buttons in table cells.

```tsx
<TableActions>
  <EditButton onClick={handleEdit} />
  <ViewButton onClick={handleView} />
  <DeleteButton onClick={handleDelete} />
</TableActions>
```

### StatusBadge

Styled status indicators with color variants.

```tsx
<StatusBadge status="Active" variant="success" />
<StatusBadge status="Pending" variant="warning" />
<StatusBadge status="Error" variant="error" />
<StatusBadge status="Info" variant="info" />
```

---

## Page Templates

### ManagementPageTemplate

Complete page template for data management interfaces.

```tsx
<ManagementPageTemplate
  title="User Management"
  description="Manage user accounts and permissions"
  backHref="/settings"
  data={users}
  columns={userColumns}
  addButtonText="Add User"
  onAdd={() => setShowAddModal(true)}
  onRefresh={fetchUsers}
  onRowClick={handleUserClick}
  isLoading={isLoading}
  emptyMessage="No users found"
  additionalActions={<CustomButton />}
>
  {/* Additional content below the table */}
</ManagementPageTemplate>
```

### SettingsPageTemplate

Template for settings pages with card grid layout and enhanced search functionality.

#### Features:
- **Intelligent Search**: Built-in search field with keyword matching
- **Grouped Sections**: Support for both flat sections and grouped sections
- **Visual Hierarchy**: Proper group headers and separators
- **Responsive Layout**: Search field positioned in header, level with title

#### Basic Usage (Flat Sections):
```tsx
const settingSections = [
  {
    title: "User Management",
    description: "Manage user accounts and permissions",
    href: "/settings/users",
    icon: <Users className="h-5 w-5 text-green-400" />
  },
  {
    title: "System Settings",
    description: "Configure system preferences",
    href: "/settings/system",
    icon: <Settings className="h-5 w-5 text-blue-400" />,
    disabled: true
  }
];

<SettingsPageTemplate
  title="Settings"
  description="Manage your application settings"
  backHref="/dashboard"
  sections={settingSections}
  actions={<RefreshButton onClick={handleRefresh} />}
>
  {/* Additional content */}
</SettingsPageTemplate>
```

#### Advanced Usage (Grouped Sections):
```tsx
const settingsGroups = [
  {
    title: "Account Settings",
    sections: [
      {
        title: "Account",
        description: "Configure your account settings",
        href: "/settings/account",
        icon: <Key className="h-5 w-5 text-pink-400" />
      }
    ]
  },
  {
    title: "System Settings",
    sections: [
      {
        title: "User Management",
        description: "Manage system users and permissions",
        href: "/users",
        icon: <Users className="h-5 w-5 text-green-400" />
      },
      {
        title: "System Logs",
        description: "View and analyze system logs",
        href: "/settings/logs",
        icon: <FileText className="h-5 w-5 text-yellow-400" />
      },
      {
        title: "API Test",
        description: "Test and verify API endpoints",
        href: "/settings/api-test",
        icon: <Webhook className="h-5 w-5 text-purple-400" />
      }
    ]
  }
];

<SettingsPageTemplate
  title="Settings"
  description="Manage your Wolf Server"
  groups={settingsGroups}
/>
```

#### Enhanced Search Functionality:
The search field supports intelligent keyword matching:

- **"password"** → finds Account section
- **"reset"** → finds Account section
- **"users"** → finds User Management section
- **"permissions"** → finds User Management section
- **"logs"** → finds System Logs section
- **"api"** → finds API Test section
- **"monitoring"** → finds System Logs section

**Props:**
- `title` (string): Page title
- `description?` (string): Page description
- `backHref?` (string): Back button navigation
- `sections?` (SettingSection[]): Flat sections array (legacy support)
- `groups?` (SettingGroup[]): Grouped sections array (recommended)
- `actions?` (ReactNode): Additional header actions
- `className?` (string): Additional CSS classes

**Interfaces:**
```tsx
interface SettingSection {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

interface SettingGroup {
  title: string;
  sections: SettingSection[];
}
```

---

## Migration Guide

### Step 1: Update Existing Pages

Replace manual styling with WolfUI components:

**Before:**
```tsx
// src/app/users/page.tsx
<div className="space-y-6 p-8 max-w-7xl mx-auto">
  <div className="flex items-center gap-4">
    <Link href="/settings">
      <Button variant="ghost" size="icon">
        <ArrowLeft className="h-4 w-4" />
      </Button>
    </Link>
    <h1 className="text-2xl font-bold text-white neon-text">Users</h1>
  </div>
  <UsersManagement initialUsers={users} />
</div>
```

**After:**
```tsx
// src/app/users/page.tsx
import { WolfPageLayout } from "@/components/wolf-ui";

<WolfPageLayout title="User Management" backHref="/settings">
  <UsersManagement initialUsers={users} />
</WolfPageLayout>
```

### Step 2: Update Component Styling

Replace manual button styling:

**Before:**
```tsx
<Button variant="outline" size="sm">Add User</Button>
```

**After:**
```tsx
import { AddButton } from "@/components/wolf-ui";
<AddButton text="Add User" onClick={handleAdd} />
```

### Step 3: Replace Table Implementations

**Before:**
```tsx
<Card className="glass-card border-none">
  <CardHeader>
    <CardTitle className="text-white">Users</CardTitle>
  </CardHeader>
  <CardContent>
    <Table className="border-separate border-spacing-0">
      {/* Manual table implementation */}
    </Table>
  </CardContent>
</Card>
```

**After:**
```tsx
<WolfDataTable
  title="Users"
  data={users}
  columns={userColumns}
  actions={<AddButton text="Add User" onClick={handleAdd} />}
/>
```

---

## Examples

### Complete Management Page

```tsx
import { ManagementPageTemplate, StatusBadge, TableActions, EditButton, DeleteButton } from "@/components/wolf-ui";

const userColumns = [
  {
    key: 'name',
    header: 'Name',
    render: (user) => (
      <div>
        <div className="font-medium">{user.name}</div>
        <div className="text-sm text-gray-400">{user.email}</div>
      </div>
    )
  },
  {
    key: 'role',
    header: 'Role'
  },
  {
    key: 'status',
    header: 'Status',
    render: (user) => (
      <StatusBadge 
        status={user.status} 
        variant={user.status === 'active' ? 'success' : 'warning'} 
      />
    )
  },
  {
    key: 'actions',
    header: 'Actions',
    className: 'text-right',
    render: (user) => (
      <TableActions>
        <EditButton onClick={() => handleEdit(user)} />
        <DeleteButton onClick={() => handleDelete(user)} />
      </TableActions>
    )
  }
];

export default function UsersPage() {
  return (
    <ManagementPageTemplate
      title="User Management"
      description="Manage user accounts and permissions"
      backHref="/settings"
      data={users}
      columns={userColumns}
      addButtonText="Add User"
      onAdd={() => setShowAddModal(true)}
      onRefresh={fetchUsers}
      isLoading={isLoading}
      emptyMessage="No users found. Add your first user to get started."
    />
  );
}
```

### Settings Page with Grouped Sections and Enhanced Search

```tsx
import { SettingsPageTemplate } from "@/components/wolf-ui";
import { Users, Shield, Database, Bell, Key, FileText, Webhook } from "lucide-react";

const settingsGroups = [
  {
    title: "Account Settings",
    sections: [
      {
        title: "Account",
        description: "Configure your account settings",
        href: "/settings/account",
        icon: <Key className="h-5 w-5 text-pink-400" />
      },
      {
        title: "Security",
        description: "Configure authentication and security settings",
        href: "/settings/security",
        icon: <Shield className="h-5 w-5 text-blue-400" />
      }
    ]
  },
  {
    title: "System Settings",
    sections: [
      {
        title: "User Management",
        description: "Manage system users and permissions",
        href: "/users",
        icon: <Users className="h-5 w-5 text-green-400" />
      },
      {
        title: "System Logs",
        description: "View and analyze system logs",
        href: "/settings/logs",
        icon: <FileText className="h-5 w-5 text-yellow-400" />
      },
      {
        title: "API Test",
        description: "Test and verify API endpoints",
        href: "/settings/api-test",
        icon: <Webhook className="h-5 w-5 text-purple-400" />
      },
      {
        title: "Database",
        description: "Database configuration and maintenance",
        href: "/settings/database",
        icon: <Database className="h-5 w-5 text-cyan-400" />
      }
    ]
  }
];

export default function SettingsPage() {
  return (
    <SettingsPageTemplate
      title="Settings"
      description="Manage your Wolf Server"
      groups={settingsGroups}
    />
  );
}

// Example search queries that work with enhanced search:
// - "password" or "reset" → finds Account section
// - "users" or "permissions" → finds User Management section
// - "logs" or "monitoring" → finds System Logs section
// - "api" or "endpoints" → finds API Test section
```

### Custom Content Card

```tsx
import { WolfContentCard, ActionButton } from "@/components/wolf-ui";

<WolfContentCard
  title="System Status"
  description="Current system health and performance metrics"
  actions={
    <>
      <ActionButton onClick={handleRefresh}>Refresh</ActionButton>
      <ActionButton onClick={handleExport}>Export</ActionButton>
    </>
  }
>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="text-center">
      <div className="text-2xl font-bold text-[#05ffa1]">99.9%</div>
      <div className="text-sm text-gray-400">Uptime</div>
    </div>
    <div className="text-center">
      <div className="text-2xl font-bold text-[#fffb96]">1,234</div>
      <div className="text-sm text-gray-400">Active Users</div>
    </div>
    <div className="text-center">
      <div className="text-2xl font-bold text-[#00E5CC]">42ms</div>
      <div className="text-sm text-gray-400">Response Time</div>
    </div>
  </div>
</WolfContentCard>
```

---

## Benefits

### ✅ Automatic Consistency
- All components follow WolfManager styling patterns automatically
- No need to remember or copy-paste CSS classes
- Consistent spacing, typography, and colors

### ✅ Developer Productivity
- Reduced development time for new pages
- Focus on business logic instead of styling
- TypeScript support with IntelliSense

### ✅ Maintainable Design System
- Changes to styling can be made in one place
- Easy to update design patterns across the application
- Built-in accessibility features

### ✅ Quality Assurance
- Prevents styling inconsistencies
- Standardized component behavior
- Built-in loading and error states

---

## Best Practices

1. **Use Templates First**: Start with `ManagementPageTemplate` or `SettingsPageTemplate` for common use cases
2. **Compose Components**: Use `WolfPageLayout` + `WolfContentCard` for custom layouts
3. **Consistent Actions**: Use specialized buttons (`AddButton`, `EditButton`, etc.) instead of generic `Button`
4. **Status Indicators**: Use `StatusBadge` with appropriate variants for consistent status display
5. **Table Actions**: Always wrap action buttons in `TableActions` for proper alignment

This component system ensures that all new pages automatically follow WolfManager design patterns while providing flexibility for custom implementations.