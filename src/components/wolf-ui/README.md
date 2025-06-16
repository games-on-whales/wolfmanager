# WolfManager Component System

A comprehensive set of reusable components that automatically apply WolfManager styling patterns.

## Quick Import

```tsx
import { 
  // Layout Components
  WolfPageLayout,
  WolfContentCard,
  
  // Button Components
  ActionButton,
  AddButton,
  RefreshButton,
  EditButton,
  DeleteButton,
  BackButton,
  
  // Data Components
  WolfDataTable,
  TableActions,
  StatusBadge,
  
  // Page Templates
  ManagementPageTemplate,
  SettingsPageTemplate,
  FormPageTemplate
} from "@/components/wolf-ui";
```

## Component Categories

### 🏗️ Layout Components
- **WolfPageLayout**: Standard page container with header and back button
- **WolfContentCard**: Glass-card container for content sections

### 🔘 Button Components
- **ActionButton**: Primary actions (`variant="outline" size="sm"`)
- **AddButton**: Add actions with plus icon
- **RefreshButton**: Refresh actions with refresh icon
- **EditButton**: Edit actions with edit icon
- **DeleteButton**: Delete actions with red styling
- **BackButton**: Back navigation with arrow icon

### 📊 Data Components
- **WolfDataTable**: Fully styled data table with loading/empty states
- **TableActions**: Container for action buttons in table cells
- **StatusBadge**: Colored status indicators

### 📄 Page Templates
- **ManagementPageTemplate**: Complete data management interface
- **SettingsPageTemplate**: Settings page with card grid
- **FormPageTemplate**: Form page with consistent styling

## Usage Examples

### Simple Page
```tsx
<WolfPageLayout title="My Page" backHref="/dashboard">
  <WolfContentCard title="Content">
    <p>Page content here</p>
  </WolfContentCard>
</WolfPageLayout>
```

### Management Page
```tsx
<ManagementPageTemplate
  title="Users"
  backHref="/settings"
  data={users}
  columns={userColumns}
  onAdd={() => setShowModal(true)}
  onRefresh={fetchUsers}
/>
```

### Form Page
```tsx
<FormPageTemplate
  title="Add User"
  backHref="/users"
  onSubmit={handleSubmit}
  onCancel={() => router.back()}
>
  <FormSection title="User Details">
    {/* Form fields */}
  </FormSection>
</FormPageTemplate>
```

## Benefits

✅ **Automatic Consistency** - All WolfManager styling patterns applied automatically  
✅ **Faster Development** - Pre-built templates for common use cases  
✅ **Type Safety** - Full TypeScript support with IntelliSense  
✅ **Maintainable** - Update styling in one place  
✅ **Accessible** - Built-in accessibility features  

## Documentation

See [`docs/wolfmanager-components.md`](../../docs/wolfmanager-components.md) for complete documentation with examples and migration guide.