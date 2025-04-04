# Project TODO List

## Project Setup

- [x] Initialize Next.js project with TypeScript
- [x] Configure Tailwind CSS
- [x] Set up project structure and directories (/src, /docs)
- [x] Install and configure ESLint and Prettier
- [x] Set up Git repository and .gitignore

## Authentication & Authorization

- [x] Install and configure NextAuth.js
- [x] Set up basic authentication providers
- [x] Implement role-based access control

  ### Priority 1 - Critical Security & Core Functionality

  - [x] Create standardized API response utilities
  - [x] Create role checking utilities
  - [x] Implement Server Action wrapper with role checks
  - [x] Add consistent role checks on all API endpoints
  - [x] Audit and secure all admin-only routes in middleware
  - [x] Implement proper error responses for unauthorized access
  - [x] Add role validation on session refresh

  ### Priority 1 - Testing Tasks

  - [x] Test role check utilities
    - [x] Test as non-logged in user
    - [x] Test as regular user on admin endpoint
    - [x] Test as admin user
  - [x] Test API response format
    - [x] Verify success response structure
    - [x] Verify error response structure
    - [x] Check HTTP status codes
  - [x] Test logging implementation
    - [x] Verify successful actions are logged
    - [x] Verify error logging includes context
    - [x] Confirm admin access attempts are logged

  ### Priority 2 - User Experience & UI Security

  - [x] Create user-friendly access denied pages
    - [x] Unauthorized access page
    - [x] Forbidden access page
    - [x] Session expired page
    - [x] Proper redirects in middleware
    - [x] Integration with auth components
  - [x] Add consistent admin/user conditional rendering for components
  - [x] Hide admin-only navigation items from regular users
  - [x] Create a reusable `isAdmin` hook for component-level checks

  ### Priority 3 - Monitoring & Logging

  - [x] Add audit logging for admin-only operations
  - [x] Implement logging for unauthorized access attempts
  - [x] Add basic activity tracking for admin operations

  ### Priority 4 - Testing & Documentation

  - [ ] Add unit tests for admin/user role checks
  - [ ] Create integration tests for admin-only features
  - [ ] Document admin vs user capabilities
  - [ ] Add security best practices documentation

- [x] Add protected route middleware

## Port Old Code

- [x] Port old pairing workflow
  - [x] Pairing must still append clients to the Users clients list
    - [x] Create TOML configuration utilities in src/lib/config.ts
      - [x] Implement loadConfig<T> function for type-safe TOML loading
      - [x] Implement saveConfig function for TOML file updates
      - [x] Add TypeScript interfaces for user and client configurations
    - [x] Create user service for client management
      - [x] Implement addClientToUser function for updating client list
      - [x] Add error handling and validation
      - [x] Add logging for configuration changes
    - [x] Update PairDialog component
      - [x] Integrate with TOML configuration service
      - [x] Add proper error handling for configuration updates
      - [x] Update success/error notifications
    - [x] Pair Page Updates
      - [x] Update Paired Clients list to show only the users paired client
      - [x] Add Unpair button/function to paired clients
    - [ ] Testing and Validation
      - [ ] Test TOML file operations
      - [ ] Verify client data persistence
      - [ ] Test error scenarios
      - [ ] Validate TOML file structure
    - [ ] Required Bug Fixes
      - [ ] Fix: PIN Validation in Pairing Dialog
        - [x] Create PIN validation service
          - [x] Implement PIN format validation using Zod (4-digit PIN)
          - [x] Add rate limiting mechanism
          - [ ] Add unit tests for validation service
        - [x] Update server actions
          - [x] Add PIN verification endpoint
          - [x] Integrate with Wolf API
          - [x] Add comprehensive error handling
          - [x] Refactor to use server actions instead of API routes
          - [ ] Add integration tests
        - [x] Enhance PairDialog component
          - [x] Add real-time PIN validation
          - [x] Implement error states and feedback
          - [x] Add loading states
          - [x] Refactor to use new server actions
          - [ ] Add E2E tests
        - [x] Implement logging
          - [x] Add logging for validation attempts
          - [x] Add logging for rate limiting
          - [x] Add logging for Wolf API interactions
      - [ ] Fix: Client List Synchronization
        - [x] Add Wolf client list comparison during paired clients fetch
        - [x] Filter out stale pairing requests
        - [x] Add manual refresh for pending requests
        - [x] Show pair_secret for debugging
        - [ ] Add periodic sync mechanism
        - [x] Add logging for sync operations and removals
      - [ ] Fix: Duplicate Pairing Requests
        - [x] Add pairing secret storage to user configuration
        - [x] Implement pairing secret validation
        - [x] Filter out previously used pairing requests
        - [ ] Add cleanup mechanism for old pairing secrets
        - [x] Add logging for duplicate request detection
      - [x] Fix: Client Verification Process
        - [x] Update client verification to use Wolf API instead of TOML
        - [x] Add verification after pairing
        - [x] Improve error handling for failed verifications
      - [x] Fix: Pairing Process
        - [x] Remove incorrect /pair/complete endpoint usage
        - [x] Use /pair/client response for pairing status
        - [x] Verify client exists in Wolf
        - [x] Save to TOML only after verification
      - [x] Fix: Unpairing Process
        - [x] Add proper unpairing with Wolf API
        - [x] Add waiting period for Wolf processing
        - [x] Remove from TOML after successful unpairing
        - [x] Synchronize after unpairing

## Bug CleanUp

- [ ] API Test Console
  - [ ] Post input text field has text and cursor in different spots
  - [ ] Post requests input fields do not have example of the body to post
  - [ ] UI navigation is not scrollable
  - [ ] API path listed is not correct for wolf

## UI/Components

- [x] Install and configure ShadCN component library
- [x] Create base layout components
- [x] Set up responsive navigation
- [ ] Build reusable form components
- [ ] Implement light mode support (partial dark is the default light is broken)

## Logging & Monitoring

- [x] Implement custom logging system
  - [x] Server-side logging implementation
  - [x] Client-side logging implementation
  - [x] Log viewer UI with filtering and search
  - [x] Real-time log updates
  - [x] Log level visualization and statistics
  - [x] Log export functionality
  - [x] Server actions for secure log access
- [ ] Add error boundary components
- [ ] Set up performance monitoring
- [x] Implement audit logging for sensitive operations
- [ ] Add log rotation and cleanup strategy
- [ ] Add log persistence configuration options
- [ ] Implement log archiving system

### Priority 3 - Monitoring & Logging Improvements

- [x] Add audit logging for admin-only operations
- [x] Implement logging for unauthorized access attempts
- [x] Add basic activity tracking for admin operations
- [x] Create advanced log viewer interface
  - [x] Real-time log updates
  - [x] Advanced filtering and search
  - [x] Log level statistics
  - [x] Interactive UI elements
  - [x] Copy and export functionality
- [ ] Add log aggregation across services
- [ ] Implement log retention policies
- [ ] Add system health monitoring
- [ ] Create logging documentation

## Documentation

- [x] Create initial project documentation
- [x] Add component documentation
- [ ] Write API documentation
- [ ] Create user guides

## Testing

- [ ] Set up Jest and React Testing Library
- [ ] Write unit tests for utilities
- [ ] Create component test suite
- [ ] Implement E2E tests with Cypress

## Optimization

- [ ] Implement image optimization
- [ ] Add API route caching
- [ ] Optimize bundle size
- [ ] Implement lazy loading for components

## Bugs

- [ ] Fix mobile navigation menu flickering ❌ (Requires investigation of z-index conflicts)
- [ ] Address hydration mismatch in auth components
- [ ] Resolve memory leak in real-time updates
- [ ] Fix pairing dialog accepting invalid PINs
  - [x] Fix friendly name field being disabled after PIN validation
  - [ ] Add proper PIN validation in PairDialog component
  - [ ] Implement server-side PIN verification
  - [ ] Add error handling for invalid PINs
- [ ] Fix paired clients list synchronization with Wolf
  - [ ] Compare local config with Wolf's paired client list
  - [ ] Auto-remove clients that no longer exist in Wolf
  - [ ] Add periodic sync to keep lists in sync
  - [ ] Add logging for sync operations
- [ ] Fix duplicate pairing requests issue
  - [ ] Store pairing secrets in user configuration
  - [ ] Validate pairing requests against stored secrets
  - [ ] Filter out already used pairing requests
  - [ ] Add cleanup for old pairing secrets

## Future Enhancements

- [ ] Add real-time notifications
- [ ] Implement data export functionality
- [ ] Add multi-language support
- [ ] Integrate analytics dashboard
