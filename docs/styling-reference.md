# WolfManager Styling Reference Guide

A comprehensive guide for maintaining visual consistency across all WolfUI pages and components.

## Table of Contents

1. [Page Layout Patterns](#page-layout-patterns)
2. [Typography Standards](#typography-standards)
3. [Navigation Components](#navigation-components)
4. [Color Palette](#color-palette)
5. [Component Styling](#component-styling)
6. [Layout Classes](#layout-classes)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)

---

## Page Layout Patterns

### Standard Page Structure

All WolfUI pages follow a consistent container structure:

```tsx
<div className="space-y-6 p-8 max-w-7xl mx-auto">
  {/* Page Header */}
  <div className="flex items-center gap-4">
    {/* Back Button */}
    <Link href="/settings">
      <Button variant="ghost" size="icon">
        <ArrowLeft className="h-4 w-4" />
      </Button>
    </Link>
    {/* Page Title */}
    <div>
      <h1 className="text-2xl font-bold text-white neon-text">Page Title</h1>
    </div>
  </div>
  
  {/* Page Content */}
  {children}
</div>
```

### Container Structure

- **Main Container**: `space-y-6 p-8 max-w-7xl mx-auto`
  - `space-y-6`: Consistent vertical spacing between sections
  - `p-8`: Standard padding on all sides
  - `max-w-7xl mx-auto`: Centered content with maximum width

### Header Layouts

#### With Back Button
```tsx
<div className="flex items-center gap-4">
  <Link href="/previous-page">
    <Button variant="ghost" size="icon">
      <ArrowLeft className="h-4 w-4" />
    </Button>
  </Link>
  <div>
    <h1 className="text-2xl font-bold text-white neon-text">Page Title</h1>
  </div>
</div>
```

#### With Description
```tsx
<div className="flex justify-between items-center">
  <div>
    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
    <p className="text-muted-foreground">Manage your account settings</p>
  </div>
</div>
```

---

## Typography Standards

### Page Titles (H1)
```css
.page-title {
  @apply text-2xl font-bold text-white neon-text;
}
```

**Usage**: `<h1 className="text-2xl font-bold text-white neon-text">Page Title</h1>`

### Section Headers (H2)
```css
.section-header {
  @apply text-xl font-semibold mb-4;
}
```

**Usage**: `<h2 className="text-xl font-semibold mb-4">Section Title</h2>`

### Card Titles
```css
.card-title {
  @apply text-white text-xl;
}
```

### Descriptions and Subtitles
```css
.description {
  @apply text-gray-400;
}

.muted-text {
  @apply text-muted-foreground;
}
```

### Table Headers
```css
.table-header {
  @apply text-[#fffb96] py-3 px-4;
}
```

---

## Navigation Components

### Back Button Pattern
```tsx
<Link href="/previous-page">
  <Button variant="ghost" size="icon">
    <ArrowLeft className="h-4 w-4" />
  </Button>
</Link>
```

### Button Variants

#### Primary Action Button
```tsx
<Button variant="outline" size="sm">Add User</Button>
```

#### Icon Button
```tsx
<Button variant="ghost" size="icon">
  <Icon className="h-4 w-4" />
</Button>
```

#### Destructive Action
```tsx
<Button
  size="icon"
  variant="ghost"
  className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
>
  <Trash2 className="h-4 w-4" />
</Button>
```

---

## Color Palette

### Primary Colors
- **Neon Cyan**: `#00E5CC` (`--neon-teal`)
- **Neon Blue**: `#01CDFE` (`--neon-blue`)
- **Neon Green**: `#05FFA1` (`--neon-green`)
- **Neon Navy**: `#0077B6` (`--neon-navy`)
- **Neon Yellow**: `#FFFB96` (`--neon-yellow`)

### Text Colors
- **Primary Text**: `text-white`
- **Secondary Text**: `text-gray-400`
- **Muted Text**: `text-muted-foreground`
- **Accent Text**: `text-[#fffb96]` (for table headers)
- **Success**: `text-[#05ffa1]`
- **Error**: `text-red-400`

### Background Colors
- **Dark Background**: `#1A1A1A` (`--dark-bg`)
- **Glass Card**: `rgba(255, 255, 255, 0.05)` (`--glass-effect`)
- **Card Background**: `rgba(255, 255, 255, 0.1)` (`--card-bg`)

### Border Colors
- **Default Border**: `border-[rgba(255,255,255,0.1)]`
- **Table Borders**: `border-neutral-700`
- **Neon Borders**: `border-[var(--neon-blue)]`

---

## Component Styling

### Glass Card Pattern
```tsx
<Card className="glass-card border-none">
  <CardHeader>
    <CardTitle className="text-white">Card Title</CardTitle>
    <CardDescription className="text-gray-400">
      Card description text
    </CardDescription>
  </CardHeader>
  <CardContent className="p-6">
    {/* Card content */}
  </CardContent>
</Card>
```

### Table Styling
```tsx
<Table className="border-separate border-spacing-0">
  <TableHeader>
    <TableRow className="border-[rgba(255,255,255,0.1)]">
      <TableHead className="text-[#fffb96] py-3 px-4">
        Header
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="border-b border-neutral-700 hover:bg-neutral-800">
      <TableCell className="text-white py-3 px-4">
        Cell content
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Form Elements
```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Field Label</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Settings Card Grid
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <Link href="/settings/section" className="block">
    <Card className="glass-card p-6 transition-colors cursor-pointer h-[100px]">
      <div className="flex items-start space-x-4">
        <div className="bg-primary/10 p-3 rounded-lg">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Section Title</h3>
          <p className="text-sm text-muted-foreground">
            Section description
          </p>
        </div>
      </div>
    </Card>
  </Link>
</div>
```

---

## Layout Classes

### Container Patterns
- **Main Container**: `space-y-6 p-8 max-w-7xl mx-auto`
- **Section Spacing**: `space-y-8`
- **Card Content**: `p-6`
- **Form Spacing**: `space-y-4`

### Flex Layouts
- **Header Row**: `flex items-center gap-4`
- **Justified Content**: `flex justify-between items-center`
- **Icon with Text**: `flex items-center gap-2`
- **Table Actions**: `flex justify-end`

### Grid Systems
- **Settings Grid**: `grid gap-4 md:grid-cols-2 lg:grid-cols-3`
- **Two Column**: `grid gap-6 md:grid-cols-2`
- **Responsive Grid**: `grid gap-6 transition-all duration-500 ease-in-out`

### Responsive Breakpoints
- **Mobile First**: Default styles for mobile
- **Medium**: `md:` prefix for tablet and up
- **Large**: `lg:` prefix for desktop and up

---

## Code Examples

### Complete Page Structure
```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ExamplePage() {
  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white neon-text">Example Page</h1>
        </div>
      </div>

      {/* Main Content */}
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-white">Section Title</CardTitle>
          <CardDescription className="text-gray-400">
            Section description
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {/* Content goes here */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Table Implementation
```tsx
<Card className="glass-card border-none">
  <CardHeader>
    <div className="flex justify-between items-center">
      <div>
        <CardDescription className="text-gray-400">
          Manage items and their properties
        </CardDescription>
      </div>
      <Button variant="outline" size="sm">Add Item</Button>
    </div>
  </CardHeader>
  <CardContent className="p-6">
    <Table className="border-separate border-spacing-0">
      <TableHeader>
        <TableRow className="border-[rgba(255,255,255,0.1)]">
          <TableHead className="text-[#fffb96] py-3 px-4">Name</TableHead>
          <TableHead className="text-[#fffb96] py-3 px-4">Status</TableHead>
          <TableHead className="text-[#fffb96] text-right py-3 px-4">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="border-b border-neutral-700 hover:bg-neutral-800">
          <TableCell className="text-white py-3 px-4">Item Name</TableCell>
          <TableCell className="text-white py-3 px-4">Active</TableCell>
          <TableCell className="text-right py-3 px-4">
            <Button size="icon" variant="ghost" className="h-8 w-8">
              <Edit className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### Form Layout
```tsx
<Card className="glass-card border-none">
  <CardHeader>
    <CardTitle className="text-white">Form Title</CardTitle>
    <CardDescription className="text-gray-400">
      Form description
    </CardDescription>
  </CardHeader>
  <CardContent className="p-6">
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  </CardContent>
</Card>
```

---

## Best Practices

### Accessibility Considerations

1. **Screen Reader Support**
   ```tsx
   <Button title="Delete User">
     <Trash2 className="h-4 w-4" />
     <span className="sr-only">Delete User</span>
   </Button>
   ```

2. **Keyboard Navigation**
   - Ensure all interactive elements are keyboard accessible
   - Use proper focus states with `focus-visible:outline-none focus-visible:ring-2`

3. **Color Contrast**
   - Primary text uses `text-white` for high contrast
   - Secondary text uses `text-gray-400` for appropriate contrast
   - Interactive elements have clear hover states

### Performance Optimization

1. **Consistent Class Usage**
   - Use predefined utility classes consistently
   - Avoid inline styles when possible
   - Leverage Tailwind's purging for smaller bundle sizes

2. **Component Reusability**
   - Extract common patterns into reusable components
   - Use the established card and table patterns
   - Maintain consistent spacing and typography

### Responsive Design Guidelines

1. **Mobile-First Approach**
   ```tsx
   <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
   ```

2. **Flexible Layouts**
   - Use `space-y-*` for vertical spacing
   - Use `gap-*` for grid and flex layouts
   - Ensure content is readable on all screen sizes

3. **Touch-Friendly Interactions**
   - Minimum touch target size of 44px
   - Adequate spacing between interactive elements

### Consistency Maintenance

1. **Color Usage**
   - Use CSS custom properties for neon colors
   - Stick to the established color palette
   - Use semantic color classes (`text-white`, `text-gray-400`)

2. **Typography Hierarchy**
   - Page titles: `text-2xl font-bold text-white neon-text`
   - Section headers: `text-xl font-semibold mb-4`
   - Card titles: `text-white text-xl`
   - Descriptions: `text-gray-400`

3. **Spacing Standards**
   - Page container: `space-y-6 p-8`
   - Card content: `p-6`
   - Form elements: `space-y-4`
   - Section spacing: `space-y-8`

### Component Guidelines

1. **Glass Card Usage**
   - Always use `glass-card border-none` for main content cards
   - Include proper header structure with title and description
   - Use consistent padding with `p-6`

2. **Table Implementation**
   - Use `border-separate border-spacing-0` for clean borders
   - Header cells: `text-[#fffb96] py-3 px-4`
   - Body cells: `text-white py-3 px-4`
   - Row hover: `hover:bg-neutral-800`

3. **Button Consistency**
   - Primary actions: `variant="outline" size="sm"`
   - Icon buttons: `variant="ghost" size="icon"`
   - Destructive actions: Include appropriate color classes

### Error Handling

1. **Loading States**
   ```tsx
   {isLoading ? (
     <div className="glass-card border-none p-6">
       <h2 className="text-white text-xl">Loading...</h2>
       <p className="text-gray-400">Please wait...</p>
     </div>
   ) : (
     // Normal content
   )}
   ```

2. **Error States**
   ```tsx
   {error && (
     <div className="glass-card border-none p-6">
       <h2 className="text-white text-xl">Error</h2>
       <p className="text-gray-400">{error}</p>
       <Button onClick={retry} className="mt-4">Retry</Button>
     </div>
   )}
   ```

3. **Empty States**
   ```tsx
   {items.length === 0 && (
     <TableRow>
       <TableCell colSpan={3} className="h-24 text-center text-gray-400 py-3 px-4">
         No items found
       </TableCell>
     </TableRow>
   )}
   ```

---

## Implementation Checklist

When creating a new page or component, ensure:

- [ ] Uses standard container structure (`space-y-6 p-8 max-w-7xl mx-auto`)
- [ ] Includes proper page header with back button if applicable
- [ ] Uses `glass-card border-none` for main content areas
- [ ] Follows typography hierarchy (h1 with `neon-text`, proper descriptions)
- [ ] Implements consistent table styling if tables are used
- [ ] Uses established color palette and CSS custom properties
- [ ] Includes proper loading, error, and empty states
- [ ] Maintains accessibility standards (screen reader support, keyboard navigation)
- [ ] Follows responsive design patterns
- [ ] Uses semantic HTML and proper ARIA labels where needed

This reference guide ensures all WolfUI pages maintain visual consistency and professional appearance while providing an excellent user experience across all devices and use cases.