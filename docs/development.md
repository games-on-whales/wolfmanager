
# Development Workflow

This diagram illustrates our release-based development workflow where `stable` serves as the main production branch.

```mermaid
%%{init: { 'logLevel': 'info', 'theme': 'base', 'gitGraph': {'showBranches': true, 'showCommitLabel': true, 'mainBranchName': 'stable'}} }%%
gitGraph
    commit id: "Initial commit" tag: "202506.001"
    
    %% Create release branch for June 2025 second release
    branch release/202506.002
    checkout release/202506.002
    commit id: "Setup release 202506.002"
    
    %% Feature development from release branch
    branch feature/user-auth
    checkout feature/user-auth
    commit id: "Add login component"
    commit id: "Implement JWT auth"
    commit id: "Add password validation"
    
    %% Another feature branch
    checkout release/202506.002
    branch feature/dashboard
    checkout feature/dashboard
    commit id: "Create dashboard layout"
    commit id: "Add metrics widgets"
    
    %% Hotfix branch for critical issue
    checkout stable
    branch hotfix/security-patch
    checkout hotfix/security-patch
    commit id: "Fix XSS vulnerability" type: HIGHLIGHT
    
    %% Merge hotfix back to stable immediately
    checkout stable
    merge hotfix/security-patch
    commit id: "Deploy hotfix" tag: "202506.001.1"
    
    %% Continue feature development
    checkout feature/user-auth
    commit id: "Add unit tests"
    
    %% Merge completed features into release
    checkout release/202506.002
    merge feature/user-auth
    commit id: "Integrate auth feature"
    
    checkout release/202506.002
    merge feature/dashboard
    commit id: "Integrate dashboard"
    
    %% Bug fix directly on release branch
    commit id: "Fix integration issues"
    commit id: "Update documentation"
    
    %% Merge hotfix into release branch to keep in sync
    merge hotfix/security-patch
    commit id: "Sync security patch"
    
    %% Final release preparation
    commit id: "Bump version to 202506.002"
    commit id: "Update changelog"
    
    %% Deploy to stable when ready
    checkout stable
    merge release/202506.002
    commit id: "Release 202506.002" tag: "202506.002"
```

## Workflow Explanation

### Branch Strategy
- **`stable`**: Main production branch containing stable, released code
- **`release/YYYYMM.###`**: Release preparation branches created from stable
- **`feature/feature-name`**: Feature development branches created from release
- **`hotfix/issue-name`**: Critical fixes created from stable for immediate deployment

### Versioning Scheme
Our releases follow the **YYYYMM.###** format:
- **YYYY**: 4-digit year (e.g., 2025)
- **MM**: 2-digit month (01-12)
- **###**: 3-digit increment starting from 001 for each month

**Examples:**
- `202506.001` - First release in June 2025
- `202506.002` - Second release in June 2025
- `202507.001` - First release in July 2025
- `202506.001.1` - Hotfix for 202506.001

### Development Process
1. **Release Planning**: Create release branch from `stable` using next version number (e.g., `release/202506.002`)
2. **Feature Development**: Create feature branches from the target release branch
3. **Feature Integration**: Merge completed features back into release branch
4. **Hotfix Handling**: Create hotfix branches from `stable`, deploy immediately with patch version (e.g., `202506.001.1`)
5. **Release Deployment**: When release is ready, merge back to `stable` with version tag

### Docker Tagging Strategy

Our Docker images are automatically built and tagged through GitHub Actions for both preview and production releases.

#### Automated Tagging Process

**Preview Releases (Release Branch)**
1. **Trigger**: Docker build runs automatically on push to `release/YYYYMM.###` branches
2. **Version Generation**: Uses `preview-YYYYMM.###` format for testing
3. **Tag Creation**: Automatically creates preview tag for testing environments
4. **Registry**: Images are pushed to GitHub Container Registry (`ghcr.io`)

**Production Releases (Stable Branch)**
1. **Trigger**: Docker build runs automatically on push to `stable` branch
2. **Version Generation**: Uses the same YYYYMM.### format as git tags
3. **Tag Creation**: Automatically creates and pushes git tag, then builds Docker image with matching tag
4. **Registry**: Images are pushed to GitHub Container Registry (`ghcr.io`)

#### Docker Tag Examples
- **Preview Release**: `ghcr.io/[repository]/wolfmanager:preview-202506.002`
- **Production Release**: `ghcr.io/[repository]/wolfmanager:202506.002`
- **Latest Stable**: `ghcr.io/[repository]/wolfmanager:latest` (always points to most recent stable)
- **Development Branches**: `ghcr.io/[repository]/wolfmanager:feature-user-auth` (branch name sanitized)

#### Tag Safety Features
- **Duplicate Prevention**: Workflow checks for existing tags before creation
- **Automatic Increment**: Scans existing tags to determine next increment number
- **Multi-platform**: Builds for both `linux/amd64` and `linux/arm64`
- **Metadata**: Includes build information, version, and creation timestamp

#### Complete Workflow Integration
```
Feature Merge → Release Branch → Preview Docker → Testing → Stable Branch → Production Docker
     ↓              ↓                ↓              ↓           ↓              ↓
  feature/auth  release/202506.002  preview-202506.002  QA Testing  202506.002  wolfmanager:202506.002
```

#### Deployment Pipeline
1. **Development**: Features merged into release branch trigger preview builds
2. **Testing**: Preview images (`preview-YYYYMM.###`) deployed to staging/test environments
3. **Validation**: QA testing performed on preview releases
4. **Production**: Release branch merged to stable triggers production build with final version tag

### Key Improvements
- **Clear Semantic Commits**: Descriptive commit messages that explain the actual changes
- **Proper Branching Strategy**: Follows the specified stable→release→feature workflow
- **Date-based Versioning**: Uses YYYYMM.### format for clear chronological tracking
- **Automated Docker Deployment**: Seamless integration between git releases and container deployment
- **Visual Clarity**: Enabled branch visibility and commit labels for better readability
- **Documentation Context**: Added comprehensive explanation of the workflow
- **Realistic Scenarios**: Includes common development scenarios like hotfixes and feature integration