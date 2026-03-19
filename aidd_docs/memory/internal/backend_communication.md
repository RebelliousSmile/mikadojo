# Communication between backend and frontend

## Overview
- **Services**: fetch API (vanilla JS, no framework)
- **Request Types**: GET, POST
- **Data Flow**: Frontend fetches graph JSON from dev server, renders views, user actions POST updates, server writes JSON files, frontend re-renders
- **Error Handling**: try/catch around fetch calls, `showError()` displays errors in UI
- **Validation**: Server validates status against `statusOptions` array, validates graph name with regex

### Data Flow

```mermaid
---
title: Status Update Flow
---
sequenceDiagram
    participant U as User
    participant F as app.js
    participant S as server.js
    participant FS as JSON File

    U->>F: Clicks status button
    F->>F: updateNodeStatus()
    F->>F: persistStatusChange()
    F->>S: POST /api/graphs/:name/nodes/:id/status
    S->>FS: Read JSON file
    S->>FS: Update node status and write back
    S->>F: Response with updated graph
    F->>F: Re-render current view
```

### Auto-refresh Flow

```mermaid
---
title: Auto-refresh Polling Flow
---
sequenceDiagram
    participant F as app.js
    participant S as server.js

    loop Every 3s
        F->>S: GET /api/last-change
        S->>F: Timestamp response
        alt Timestamp changed
            F->>F: reloadActiveGraph()
            F->>S: GET /api/graphs
            S->>F: Graph data
            F->>F: Re-render view
        end
    end
```
