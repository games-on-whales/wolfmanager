import { getUsers } from "./actions";
import { UserErrorBoundary } from "./components/user-error-boundary";
import { ManagementPageTemplate, StatusBadge, TableActions, EditButton, DeleteButton } from "@/components/wolf-ui";
import { useState } from "react";

// Force dynamic rendering since this page uses server-side session data
export const dynamic = 'force-dynamic';

// Define user columns for the data table
const userColumns = [
  {
    key: 'name',
    header: 'Name',
    render: (user: any) => (
      <div>
        <div className="font-medium">{user.name || 'Unknown'}</div>
        <div className="text-sm text-gray-400">{user.email}</div>
      </div>
    )
  },
  {
    key: 'role',
    header: 'Role',
    render: (user: any) => user.role || 'User'
  },
  {
    key: 'status',
    header: 'Status',
    render: (user: any) => (
      <StatusBadge 
        status={user.status || 'Active'} 
        variant={user.status === 'active' ? 'success' : 'warning'} 
      />
    )
  },
  {
    key: 'created_at',
    header: 'Created',
    render: (user: any) => {
      if (!user.created_at) return 'Unknown';
      return new Date(user.created_at).toLocaleDateString();
    }
  },
  {
    key: 'actions',
    header: 'Actions',
    className: 'text-right',
    render: (user: any) => (
      <TableActions>
        <EditButton onClick={() => handleEditUser(user)} />
        <DeleteButton onClick={() => handleDeleteUser(user)} />
      </TableActions>
    )
  }
];

// Placeholder functions - these would be implemented in the actual component
function handleEditUser(user: any) {
  console.log('Edit user:', user);
}

function handleDeleteUser(user: any) {
  console.log('Delete user:', user);
}

function handleAddUser() {
  console.log('Add new user');
}

function handleRefreshUsers() {
  console.log('Refresh users');
}

export default async function UsersPageRefactored() {
  const result = await getUsers();

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to fetch users");
  }

  return (
    <UserErrorBoundary>
      <ManagementPageTemplate
        title="User Management"
        description="Manage user accounts and permissions"
        backHref="/settings"
        data={result.data}
        columns={userColumns}
        addButtonText="Add User"
        onAdd={handleAddUser}
        onRefresh={handleRefreshUsers}
        emptyMessage="No users found. Add your first user to get started."
      />
    </UserErrorBoundary>
  );
}