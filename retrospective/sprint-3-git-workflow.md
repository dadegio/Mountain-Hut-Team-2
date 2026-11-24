# Git Branching & Review Workflow

This document outlines the standard Git workflow for our Scrum sub-teams (**1 Frontend + 1 Backend + 1 QA/Tester** per User Story).

## Branch Hierarchy

- **`dev`**: Main integration branch. Must always remain stable and deployable.

- **`mh-<id>-<story-name>`** _(Story Safe-Place)_: Created from `dev`. Acts as an isolated integration branch where all work for a single User Story is assembled and tested before reaching `dev`.

- **`feature/mh-<id>-<layer>`** _(Implementation Branches)_: Created from the Story branch (e.g., `feature/mh-22-backend`, `feature/mh-22-frontend`).

- **`mh-<id>-testing`** _(QA Branch)_: Created from the Story branch once core implementation tasks are merged.

## Step-by-Step Workflow

### 1. Story Initialization

- Create the Story integration branch from an up-to-date `dev`:

  ```
  git checkout dev && git pull origin dev
  git checkout -b mh-22-story-name
  git push -u origin mh-22-story-name
  ```

### 2. Feature Implementation (FE & BE)

- Developers branch off `mh-22-story-name` for their respective layers:
  - `feature/mh-22-backend`

  - `feature/mh-22-frontend`

- Once a layer is ready, open a **Pull Request targeting `mh-22-story-name`** (not `dev`).

- The author can **self-merge** this PR to keep momentum while preserving Git history, CI checks, and YouTrack issue links.

### 3. Testing & Bug Fixing

- Once both FE and BE are merged into `mh-22-story-name`, the Tester branches off the Story branch:

  ```
  git checkout mh-22-story-name && git pull origin mh-22-story-name
  git checkout -b mh-22-testing
  ```

- The Tester writes and runs automated/E2E tests and verifies all Acceptance Criteria.

- **Handling Bugs Found During Testing:**
  - **Minor fixes:** Commit directly to `mh-22-story-name` (and pull/merge into `mh-22-testing`).

  - **Larger fixes:** Create a dedicated branch (e.g., `fix/mh-22-issue`) from `mh-22-story-name` and merge it back via PR.

- Once all tests pass, merge `mh-22-testing` into `mh-22-story-name` via PR.

### 4. Final Code Review & Merge to `dev`

- Sync `mh-22-story-name` with the latest changes from `dev` to resolve any conflicts early:

  ```
  git checkout mh-22-story-name
  git merge origin/dev
  ```

- Open a final **Pull Request from `mh-22-story-name` → `dev`**.

- Perform a **final Story Code Review** across the team/sub-team to verify code quality and Acceptance Criteria.

- Merge into `dev` and delete all temporary story/feature/testing branches.

## Key Rules & Best Practices

- **Keep `mh-<id>-<story-name>` synced with `dev`:** Merge `origin/dev` into the Story branch daily (or whenever the other sub-team closes a story) to prevent large end-of-sprint merge conflicts.

- **Never merge feature branches directly into `dev`:** All work must pass through the Story safe-place and QA verification first.

- **Auto-delete merged branches:** Enable automatic branch deletion on GitHub so feature and testing branches are cleaned up immediately upon merge. (Already done, so no problem here.)

