# Plan: Integrating Wolf Container Logs into WolfUI

This document outlines the plan for integrating logs from the `ghcr.io/games-on-whales/wolf` Docker container into the WolfUI application.

**Context:**

- WolfUI has access to the host's Docker socket (`/var/run/docker.sock` mounted as `/docker.socket`).
- Target container image: `ghcr.io/games-on-whales/wolf`.
- Logs are output to container stdout.

**1. Connection to Docker Daemon:**

- **Method:** Utilize the `dockerode` Node.js library.
- **Rationale:** Provides a robust interface for the Docker Engine API via the Unix socket.
- **Implementation Detail:** Instantiate `dockerode` pointing to the mounted socket path (`/docker.socket`).
  ```javascript
  // Conceptual example
  const Docker = require("dockerode");
  const docker = new Docker({ socketPath: "/docker.socket" });
  ```
- **Dependency:** Add `dockerode` and `@types/dockerode` to `package.json`.

**2. Container Identification:**

- **Method:**
  1.  Use `docker.listContainers({ all: true })`.
  2.  Filter the list based on the `Image` property matching `ghcr.io/games-on-whales/wolf` (potentially with a tag).
- **Handling Multiple Instances:**
  - **Challenge:** Multiple containers might run from the same image.
  - **Proposed Solutions (Prioritized):**
    1.  **Configuration:** Allow user specification of container ID/name in WolfUI settings.
    2.  **Labeling:** Filter containers based on a specific label (e.g., `wolfui.managed=true`).
    3.  **Naming:** Look for a specific name pattern (e.g., `wolf-instance`).
    4.  **Default:** If multiple found and no specific configuration, report error or default to the most recent, clearly indicating the default.
- **Output:** The unique ID of the target running container.

**3. Log Retrieval (Sample):**

- **Method:** Use `container.logs()` on the identified container object.
- **Implementation Detail:**
  ```javascript
  // Conceptual example
  const container = docker.getContainer("containerId");
  const logOpts = {
    stdout: true,
    stderr: true,
    tail: 100, // Get the last 100 lines
    timestamps: true,
  };
  const logStream = await container.logs(logOpts);
  // Process the stream (handle potential Buffer conversion)
  ```
- **Purpose:** Analyze log format for parsing and display logic.

**4. Log Retrieval (Continuous):**

- **Method:** Streaming via `container.logs()` with `follow: true`.
- **Implementation Detail:**
  ```javascript
  // Conceptual example
  const streamOpts = {
    stdout: true,
    stderr: true,
    follow: true,
    timestamps: true,
    since: Math.floor(Date.now() / 1000), // Optional: Start time
  };
  const liveLogStream = await container.logs(streamOpts);
  // liveLogStream is a Readable stream emitting new log data.
  ```
- **Recommendation:** Implement streaming via a backend service. The service maintains the Docker log stream connection and pushes updates to connected frontend clients (e.g., via WebSockets).
  - **Pros:** Real-time, efficient.
  - **Cons:** Higher complexity (stream lifecycle management), persistent connection resource usage.

**5. Error Handling:**

- **Connection Errors:** Use `try...catch` for `dockerode` instantiation and API calls (handle `ECONNREFUSED`, `EACCES`).
- **Container Not Found:** Handle cases where no matching container is running or a known container stops.
- **Log Retrieval Errors:** Handle stream setup/runtime errors. Log backend errors. Consider reconnection logic.
- **UI Feedback:** Provide clear status updates and error messages in the frontend.

**6. Architecture:**

- **Backend Service:** Create `src/lib/services/dockerLogService.ts` to encapsulate `dockerode` logic and manage the log stream.
- **API Endpoint(s):**
  - `GET /api/wolf/logs/sample`: Retrieves log sample.
  - WebSocket endpoint (e.g., `/api/wolf/logs/stream`): Manages persistent connection for streaming logs to clients.
- **Frontend:** UI components interact with these APIs (HTTP for sample, WebSocket for stream).

**7. Output:**

- This document (`PLAN.md`).
