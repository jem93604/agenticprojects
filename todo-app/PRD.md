# PRD: DB-backed Auth + Shared Projects + Kanban, Eisenhower Matrix, Comments, and @ Mentions

## 1. Summary
Build a full-featured task and project system on top of the existing FastAPI + SQLAlchemy backend and Next.js + Tailwind frontend.

Core deliverables:
- **DB-backed authentication** (users, password hashing, refresh token rotation, password reset, logout)
- **Shared projects** with membership and task assignment
- **Kanban board** with drag-and-drop (To Do / Doing / Done) backed by persistent DB state
- **Eisenhower matrix** view (urgent/important 2x2 grid)
- **Task comments** with **@mentions** (mention parsing, mention resolution, notifications, and mention highlighting)

## 2. Goals
1. Implement secure authentication and authorization fully enforced server-side.
2. Expand the task model to support project scoping, assignment, due dates, urgency/importance logic, comments, and mentions.
3. Deliver a polished UI with modern interactions and accessible fallbacks.

## 3. Non-Goals (initial scope)
- Transactional email delivery and integrations (unless requested)
- Real-time collaboration (websockets) for simultaneous edits
- File attachments
- Full administrative console beyond essentials (future phase)

## 4. Users & Personas
- **Individual user**: uses Kanban and Eisenhower views for personal planning.
- **Project member**: collaborates inside shared projects with assignments and comments.
- **Project owner/admin**: manages membership and permissions for the project.

## 5. User Stories
1. As a user, I can register and log in using credentials stored and validated against the database.
2. As a user, I can reset my password.
3. As a user, I can create a project and invite other users.
4. As a member, I can view project tasks in **Kanban**.
5. As a member, I can drag a task between Kanban columns and have the change persist.
6. As a member, I can view tasks in the **Eisenhower matrix** and understand where they fit.
7. As a member, I can assign tasks to one or more users in the project.
8. As a member, I can comment on tasks.
9. As a member, I can mention other users in a comment using `@handle`.
10. As a mentioned user, I can see mention notifications and highlights.

## 6. Definitions
- **Project**: a shared workspace containing tasks.
- **Task Status**: `TODO`, `DOING`, `DONE`.
- **Important**: a user-controlled importance level (baseline: `LOW`, `MEDIUM`, `HIGH`).
- **Urgent**: derived from due date (and optionally an override flag).
- **Mention**: a text pattern `@{userHandle}` that resolves to a user in the project.

## 7. Functional Requirements

### 7.1 Authentication (DB-backed)
Register:
- User provides `handle`, password, and optional profile fields.
- Password hashed using bcrypt (via `passlib`).
- `handle` must be unique.

Login:
- Verify password against stored hash.
- Issue tokens:
  - **Access token** (short-lived JWT)
  - **Refresh token** (long-lived, stored hashed in DB)

Logout:
- Revoke refresh token (and optionally invalidate access token by short expiry).

Refresh token rotation:
- Each refresh returns a new refresh token.
- Old refresh tokens are revoked/invalidated in DB.

Password reset:
- Request reset creates a one-time reset token stored hashed in DB with expiry.
- Confirm reset sets a new password and revokes existing refresh tokens.

User profile:
- Display name, handle, optional avatar URL.

### 7.2 Authorization (Project RBAC)
All project-scoped endpoints require:
- authenticated user
- membership in the project

Project roles (baseline):
- `OWNER`
- `MEMBER`

Permissions:
- Owners can invite/remove members.
- Members can create/update tasks and comment (subject to baseline permissions).

### 7.3 Projects
Project lifecycle:
- create project
- list projects for user
- invite users to project
- remove members

Invite mechanism (baseline):
- invite by `handle` (or email if later decided)

### 7.4 Tasks (expanded model)
Task fields:
- `project_id`
- `title`, `description`
- `status`: `TODO` / `DOING` / `DONE`
- `due_date` (datetime, optional)
- `importance`: enum (`LOW`, `MEDIUM`, `HIGH`)
- `urgent_override` (optional boolean; if set, overrides computed urgent state)
- `position` (numeric ordering within a status column, for Kanban reordering)
- assignees: many-to-many with users in the project

Kanban ordering:
- stable reordering uses `position` updates.

### 7.5 Kanban Board View (drag-and-drop)
UI: three columns:
- `To Do` (TODO)
- `Doing` (DOING)
- `Done` (DONE)

Drag-and-drop behavior:
- Move between columns:
  - update `status`
  - update `position` in target column
- Reorder within column:
  - update only `position`

Persistence:
- UI changes must persist to DB via API calls.

Optimistic UI:
- update UI immediately
- if API fails:
  - revert UI
  - show toast/error message

Accessibility fallback:
- provide “Move to” control in the task drawer/card for keyboard and non-drag users.

### 7.6 Eisenhower Matrix / Priority Quadrant
UI: 2x2 grid:
- urgent/important combinations based on derived logic

Derived logic (baseline defaults):
- **Important**: `importance == HIGH`
- **Urgent**:
  - due date is overdue, OR
  - due date is within `N` hours/days (default: 48h)
  - if `due_date` is null: not urgent unless `urgent_override` is set

Interactions:
- clicking a card opens the task drawer
- optional: drag-and-drop between quadrants as a future enhancement; matrix is required as visualization in v1

### 7.7 Comments and @ Mentions
Comments:
- list and create task comments (edit/delete optional; define if needed during implementation)
- store timestamp ordering

Mention parsing:
- when creating a comment, parse `@handle`
- resolve mentioned users that are members of the project
- store mention records for:
  - notification creation
  - UI highlighting

Notifications:
- mention notifications delivered to mentioned users
- notifications include link context (project/task/comment)

UI:
- comment composer has mention autocomplete after typing `@`
- mention highlights in comment text
- notifications show “mentioned you” context

## 8. API Requirements (FastAPI)
Base prefix: `/api/v1`

### 8.1 Auth Endpoints
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `GET /auth/me`
- `PATCH /auth/me`

### 8.2 Projects
- `GET /projects`
- `POST /projects`
- `GET /projects/{project_id}/members`
- `POST /projects/{project_id}/invites`
- `DELETE /projects/{project_id}/members/{user_id}`

### 8.3 Tasks
- `GET /projects/{project_id}/tasks?status=...`
- `POST /projects/{project_id}/tasks`
- `GET /projects/{project_id}/tasks/{task_id}`
- `PATCH /projects/{project_id}/tasks/{task_id}`
- `DELETE /projects/{project_id}/tasks/{task_id}`
- Kanban bulk updates:
  - `PATCH /projects/{project_id}/tasks/batch`
  - body supports `{ task_id, status, position }` updates

### 8.4 Comments and Mentions
- `GET /projects/{project_id}/tasks/{task_id}/comments`
- `POST /projects/{project_id}/tasks/{task_id}/comments`
- `PATCH /projects/{project_id}/tasks/{task_id}/comments/{comment_id}`
- `DELETE /projects/{project_id}/tasks/{task_id}/comments/{comment_id}`

### 8.5 Notifications
- `GET /notifications`
- `PATCH /notifications/{notification_id}/mark-read`

## 9. Data Model (SQLAlchemy Entities)
Auth:
- `users`: `id`, `handle` (unique), `email` (optional), `password_hash`, `display_name`, `avatar_url`, `created_at`
- `refresh_tokens`: `id`, `user_id`, `token_hash`, `created_at`, `expires_at`, `revoked_at`, `replaced_by_token_hash`
- `password_reset_tokens`: `id`, `user_id`, `token_hash`, `created_at`, `expires_at`, `used_at`

Projects:
- `projects`: `id`, `name`, `created_by`, `created_at`
- `project_members`: `project_id`, `user_id`, `role`, `joined_at`

Tasks:
- `tasks`: `id`, `project_id`, `title`, `description`, `status`, `due_date`, `importance`, `urgent_override`, `position`, `created_by`, `updated_at`
- `task_assignees`: `task_id`, `user_id`

Comments:
- `task_comments`: `id`, `project_id`, `task_id`, `author_id`, `content`, `created_at`, `edited_at`
- `task_comment_mentions`: `comment_id`, `mentioned_user_id`

Notifications:
- `notifications`: `id`, `user_id`, `type`, `payload_json`, `created_at`, `read_at`

## 10. UI Requirements (Fancy UX)

### 10.1 Layout
- top bar:
  - user menu (login/logout)
  - project switcher
  - (optional) global search
- left navigation:
  - view switcher: Kanban, Eisenhower
- main:
  - project-scoped board

### 10.2 Kanban UX
- column headers show task counts
- cards include:
  - title
  - due date badge
  - importance badge/icon
  - assignee avatars
  - comment count
- drag hover styles and drop indicators
- empty column state with “Add task” CTA

### 10.3 Eisenhower UX
- labeled 2x2 quadrants
- legends:
  - explain “Urgent” derivation rules
  - explain “Important” derivation rules
- card opens task drawer

### 10.4 Comments UX + Mentions
- mention autocomplete triggered by `@`
- mention highlighting in rendered comment content
- notifications show mention details and allow jumping to the referenced task/comment

## 11. Security Requirements
- password stored only as bcrypt hash
- refresh tokens stored hashed in DB
- refresh token rotation and revocation must be enforced
- every project-scoped endpoint checks:
  - authentication
  - membership authorization
- sanitize/escape comment content to prevent XSS

## 12. Observability
Log:
- auth failures (no sensitive data)
- mention events
- task move events (Kanban updates)

## 13. Implementation Plan (PRD-used-as-plan)
This section is intended to be executed in phases. Each phase has a “definition of done”.

### Phase 0: Foundation (Auth + DB wiring)
Deliverables:
- Add DB models + alembic migrations for:
  - `users`
  - refresh token storage
  - password reset tokens
  - auth dependencies to extract current user
- Implement API endpoints:
  - register/login/refresh/logout
  - request/confirm password reset
  - `GET/PATCH /auth/me`
- Frontend:
  - auth pages (login/register/reset request/confirm)
  - token storage strategy (access in memory or cookie; refresh in secure storage appropriate to your setup)

Definition of done:
- user can register and log in
- refresh rotation works and revoked tokens cannot refresh

### Phase 1: Projects + Membership
Deliverables:
- DB models:
  - `projects`
  - `project_members` with role
- API:
  - list/create projects
  - invite/remove members
  - guard all project endpoints with membership checks
- Frontend:
  - project switcher and ability to create a project
  - invite UI (enter handle; shows success/failure)

Definition of done:
- users cannot access tasks for projects they are not members of

### Phase 2: Tasks + Kanban persistence
Deliverables:
- DB:
  - `tasks` with status/importance/due date/position
  - `task_assignees`
- API:
  - create/update/delete tasks within a project
  - batch update endpoint for drag operations
  - task retrieval for Kanban (group by status)
- Frontend:
  - Kanban UI with drag-and-drop
  - task drawer (view/edit title/description/due date/importance/assignees)
  - optimistic drag updates + revert on error
  - keyboard accessible “Move to” fallback

Definition of done:
- dragging across columns updates the DB and survives reload

### Phase 3: Eisenhower Matrix
Deliverables:
- API logic or frontend derivation for:
  - urgent/important classification
- Frontend:
  - 2x2 matrix UI
  - filtering/toggles (at minimum: visual classification and task drawer)

Definition of done:
- every task appears in exactly one quadrant based on rules

### Phase 4: Comments + @ Mentions
Deliverables:
- DB:
  - task comments
  - mention records for comments
  - notifications
- API:
  - list/create comments
  - mention parsing and resolution during comment creation
  - create notifications for mentioned users
  - list/mark read notifications
- Frontend:
  - comment composer with `@` autocomplete
  - mention highlighting in rendered comments
  - notifications UI (bell and list)

Definition of done:
- posting `@handle` creates notifications and mention highlights are visible

### Phase 5: Polish and Accessibility
Deliverables:
- loading skeletons for board views
- error toasts and retry affordances
- keyboard navigation and focus states for drag alternatives and drawers
- UI performance tuning:
  - memoize derived computations
  - avoid re-render cascades in large lists

Definition of done:
- UI feels responsive with acceptable performance for moderate task counts

## 14. Open Questions
1. Login identifier: handle-only vs handle-or-email.
2. Urgency threshold: default `48h` vs `24h`.
3. Importance semantics: `HIGH` meaning “Important”; do we also support multiple “Important” values later?
4. Kanban reordering: is within-column position required in v1 (recommended: yes)?
5. Invite mechanism: invite by handle (baseline) vs invite links (future).

---

Notes for implementation planning:
- Use consistent design system styling already present in the frontend (Tailwind + existing “glass/neumorphic” classes).
- Follow React/Next.js performance best practices to prevent waterfall data fetching and excessive re-renders.
- Follow Web Interface Guidelines for accessibility (keyboard navigation, focus visibility, and non-drag fallbacks).

