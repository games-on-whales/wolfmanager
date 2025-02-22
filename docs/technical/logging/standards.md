# WolfUI Logging Standards

This document outlines the logging standards for the WolfUI application. All new features and modifications should follow these guidelines to maintain consistent and useful logging throughout the application.

## Core Principles

1. **Comprehensive Coverage**: Log all significant events and state changes
2. **Context-Rich**: Include relevant metadata with each log
3. **Security-Aware**: Never log sensitive information
4. **Performance-Conscious**: Log appropriately without impacting performance

## Implementation Guidelines

### Server Components

1. **Authentication & Authorization**

```typescript
// Access attempts
await logger.info(LogComponent.AUTH, "Access attempt", {
  userId: session?.user?.id,
  path: request.url,
});

// Authorization failures
await logger.warn(LogComponent.AUTH, "Unauthorized access", {
  userId: session?.user?.id,
  requiredRole: "admin",
  userRole: session?.user?.role,
});
```

2. **Data Operations**

```typescript
// Data fetching
await logger.info(LogComponent.WOLF_UI, "Data fetched", {
  count: items.length,
  filters: queryParams,
});

// Data mutations
await logger.info(LogComponent.WOLF_UI, "Resource updated", {
  resourceType: "user",
  resourceId: id,
  changes: sanitizedChanges,
});
```

3. **Error Handling**

```typescript
try {
  // operation
} catch (error) {
  await logger.error(LogComponent.WOLF_UI, "Operation failed", error, {
    context: relevantData,
  });
  throw error;
}
```

### Client Components

1. **User Actions**

```typescript
// Form submissions
clientLogger.info(LogComponent.WOLF_UI, "Form submitted", {
  formId: "user-settings",
  fields: ["username", "preferences"],
});

// UI interactions
clientLogger.debug(LogComponent.WOLF_UI, "UI interaction", {
  action: "modal_open",
  trigger: "settings_button",
});
```

2. **API Interactions**

```typescript
try {
  clientLogger.info(LogComponent.WOLF_UI, "API request initiated", {
    endpoint: "/api/resource",
    method: "POST",
  });

  const response = await apiCall();

  clientLogger.info(LogComponent.WOLF_UI, "API request successful", {
    responseStatus: response.status,
  });
} catch (error) {
  clientLogger.error(LogComponent.WOLF_UI, "API request failed", error, {
    endpoint: "/api/resource",
  });
}
```

3. **State Changes**

```typescript
clientLogger.info(LogComponent.WOLF_UI, "State updated", {
  component: "UserPreferences",
  changes: {
    before: { theme: "light" },
    after: { theme: "dark" },
  },
});
```

## Log Levels

Use appropriate log levels based on the event type:

- **DEBUG**: Detailed information for development/debugging

  ```typescript
  logger.debug(LogComponent.WOLF_UI, "Rendering component", {
    props: componentProps,
  });
  ```

- **INFO**: Normal operational events

  ```typescript
  logger.info(LogComponent.WOLF_UI, "User logged in", {
    userId: user.id,
  });
  ```

- **WARN**: Unusual but handled situations

  ```typescript
  logger.warn(LogComponent.WOLF_UI, "Rate limit approaching", {
    current: requestCount,
    limit: maxRequests,
  });
  ```

- **ERROR**: Errors requiring attention
  ```typescript
  logger.error(LogComponent.WOLF_UI, "Failed to process request", error, {
    requestId: id,
  });
  ```

## Best Practices

1. **Security**

   - Never log passwords, tokens, or sensitive data
   - Mask sensitive identifiers when needed
   - Include security-relevant context

2. **Performance**

   - Use appropriate log levels
   - Batch logging operations when possible
   - Monitor logging impact

3. **Maintenance**
   - Keep logs consistent and structured
   - Review and clean up unnecessary logging
   - Monitor log storage and rotation

## Testing

1. **Log Verification**

```typescript
test("should log user creation", async () => {
  const logSpy = jest.spyOn(logger, "info");
  await createUser(userData);
  expect(logSpy).toHaveBeenCalledWith(
    LogComponent.WOLF_UI,
    "User created",
    expect.objectContaining({ userId: expect.any(String) })
  );
});
```

2. **Error Logging**

```typescript
test("should log errors", async () => {
  const errorSpy = jest.spyOn(logger, "error");
  await expect(failingOperation()).rejects.toThrow();
  expect(errorSpy).toHaveBeenCalled();
});
```

## Examples

### Page Component

```typescript
export default async function ProtectedPage() {
  const session = await getServerSession(authOptions);

  await logger.info(LogComponent.AUTH, "Page access", {
    userId: session?.user?.id,
    page: "protected",
  });

  if (!session?.user) {
    await logger.warn(LogComponent.AUTH, "Unauthorized page access", {
      redirectTo: "/login",
    });
    redirect("/login");
  }

  try {
    const data = await fetchData();
    await logger.info(LogComponent.WOLF_UI, "Page data loaded", {
      dataCount: data.length,
    });
    return <PageContent data={data} />;
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Failed to load page data", error);
    throw error;
  }
}
```

### API Route

```typescript
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  await logger.info(LogComponent.AUTH, "API request", {
    method: "POST",
    path: request.url,
    userId: session?.user?.id,
  });

  try {
    const data = await request.json();
    const result = await processData(data);

    await logger.info(LogComponent.WOLF_UI, "API operation successful", {
      operation: "process_data",
      resultId: result.id,
    });

    return Response.json(result);
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "API operation failed", error, {
      requestUrl: request.url,
    });
    return Response.json({ error: "Operation failed" }, { status: 500 });
  }
}
```

## Monitoring

1. **Error Tracking**

   - Monitor error rates and patterns
   - Set up alerts for critical errors
   - Track authentication failures

2. **Performance Monitoring**

   - Track operation durations
   - Monitor resource usage
   - Watch for bottlenecks

3. **Security Monitoring**
   - Track authentication attempts
   - Monitor unauthorized access
   - Alert on suspicious patterns
