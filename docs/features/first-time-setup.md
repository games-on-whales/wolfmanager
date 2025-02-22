# First Time Setup Wizard Documentation

The First Time Setup Wizard is a multi-step onboarding flow that guides new users through essential configuration steps. This document explains how to extend and modify the wizard.

## Architecture Overview

The wizard is implemented as a client-side React component using:

- Next.js 14+ App Router
- React Hook Form for form management
- Zod for schema validation
- Shadcn UI components
- TypeScript for type safety

## Adding New Steps

### 1. Define the Step

Add your new step to the `steps` array in `src/app/first-time-setup/components/first-time-wizard.tsx`:

```typescript
const steps = [
  {
    id: "password",
    title: "Change Password",
    description: "Please change your password to continue",
  },
  {
    id: "steam",
    title: "Steam Integration",
    description: "Connect your Steam account (optional)",
  },
  // Add your new step here
  {
    id: "your-step-id",
    title: "Your Step Title",
    description: "Your step description",
  },
] as const;
```

### 2. Create the Schema

Define a Zod schema for your step's form validation:

```typescript
const yourStepSchema = z.object({
  field1: z.string().min(1, "Field is required"),
  field2: z.number().min(0, "Must be positive"),
  // Add more fields as needed
});

type YourStepForm = z.infer<typeof yourStepSchema>;
```

### 3. Initialize Form

Add a new form instance in the component:

```typescript
const yourStepForm = useForm<YourStepForm>({
  resolver: zodResolver(yourStepSchema),
  defaultValues: {
    field1: "",
    field2: 0,
  },
});
```

### 4. Implement the Form

Add your step's JSX in the render logic:

```typescript
{
  currentStep === 2 && (
    <Form {...yourStepForm}>
      <form
        onSubmit={yourStepForm.handleSubmit(onYourStepSubmit)}
        className="space-y-4"
      >
        <FormField
          control={yourStepForm.control}
          name="field1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Field 1</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Add more form fields */}
        <CardFooter className="px-0">
          <Button type="submit">Next</Button>
        </CardFooter>
      </form>
    </Form>
  );
}
```

### 5. Handle Submission

Implement the submit handler for your step:

```typescript
const onYourStepSubmit = async (values: YourStepForm) => {
  try {
    // Make API call if needed
    const response = await fetch("/api/your-endpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      throw new Error("Failed to process step");
    }

    // Show success message
    toast({
      title: "Success",
      description: "Step completed successfully",
    });

    // Move to next step or complete wizard
    setCurrentStep((prev) => prev + 1);
  } catch (error) {
    toast({
      variant: "destructive",
      title: "Error",
      description: error instanceof Error ? error.message : "Step failed",
    });
  }
};
```

## Best Practices

1. **Validation**

   - Always use Zod schemas for form validation
   - Include meaningful error messages
   - Consider both client and server-side validation

2. **State Management**

   - Keep form state isolated to each step
   - Use React Hook Form for form state
   - Consider using React Query for API state

3. **Error Handling**

   - Implement proper error boundaries
   - Use toast notifications for user feedback
   - Log errors appropriately

4. **UI/UX**

   - Follow Shadcn UI component patterns
   - Maintain consistent styling
   - Include loading states
   - Show progress indication

5. **TypeScript**
   - Define proper types for all forms
   - Use type inference from Zod schemas
   - Avoid type assertions when possible

## Optional Steps

To make a step optional:

1. Add a skip button in the step's footer:

```typescript
<CardFooter className="px-0 flex justify-between">
  <Button variant="outline" onClick={() => setCurrentStep((prev) => prev + 1)}>
    Skip
  </Button>
  <Button type="submit">Continue</Button>
</CardFooter>
```

2. Mark fields as optional in the schema:

```typescript
const optionalSchema = z.object({
  field1: z.string().optional(),
  field2: z.number().optional(),
});
```

## API Integration

When adding steps that require API calls:

1. Create appropriate API endpoints in `src/app/api`
2. Use proper error handling and validation
3. Update types in `src/types` if needed
4. Consider rate limiting for external API calls
5. Implement proper error responses

## Testing

When adding new steps:

1. Add unit tests for form validation
2. Add integration tests for API endpoints
3. Add E2E tests for the complete flow
4. Test error scenarios and edge cases

## Security Considerations

1. Validate all inputs server-side
2. Sanitize data before storage
3. Implement proper CSRF protection
4. Use proper authentication checks
5. Handle sensitive data appropriately

## Example: Adding a Profile Step

Here's a complete example of adding a profile information step:

```typescript
// 1. Add to steps array
const steps = [
  // ... existing steps ...
  {
    id: "profile",
    title: "Profile Information",
    description: "Tell us about yourself",
  },
] as const;

// 2. Create schema
const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  timezone: z.string(),
});

type ProfileForm = z.infer<typeof profileSchema>;

// 3. Add form instance
const profileForm = useForm<ProfileForm>({
  resolver: zodResolver(profileSchema),
  defaultValues: {
    displayName: "",
    bio: "",
    timezone: "",
  },
});

// 4. Implement submit handler
const onProfileSubmit = async (values: ProfileForm) => {
  try {
    const response = await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) throw new Error("Failed to update profile");

    toast({
      title: "Profile Updated",
      description: "Your profile has been saved successfully",
    });

    setCurrentStep((prev) => prev + 1);
  } catch (error) {
    toast({
      variant: "destructive",
      title: "Error",
      description: "Failed to update profile",
    });
  }
};

// 5. Add JSX for the step
{
  currentStep === 2 && (
    <Form {...profileForm}>
      <form
        onSubmit={profileForm.handleSubmit(onProfileSubmit)}
        className="space-y-4"
      >
        <FormField
          control={profileForm.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Add other fields */}
      </form>
    </Form>
  );
}
```
