# Graphionic Task Management

<div align="center">

# Graphionic Workspace
**Enterprise GTD & Collaborative Team Task Management System**

[![Graphionic Team](https://img.shields.io/badge/Graphionic-Team%20Workspace-0ea5e9.svg)](https://github.com/graphionic-infotech/Task_Management-)
[![License](https://img.shields.io/badge/License-Private%20%2F%20Internal-6366f1.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Desktop%20%7C%20Web-10b981.svg)]()

</div>

---

## Overview

**Graphionic Task Management** is a state-of-the-art task, project, and GTD execution system tailored for **Graphionic Infotech**. Built with modern TypeScript, Vite, React, and an offline-first reactive architecture, it delivers lightning-fast task tracking, multi-dimensional team assignments, and sleek cyber-dark aesthetics.

---

## 👥 Graphionic Team Roster

| Member | Role | Badge | Accent Color |
| :--- | :--- | :--- | :--- |
| **Mayank** | 👑 **System Admin** | `[Admin]` | Cyber Cyan (`#0ea5e9`) |
| **Rudra** | Core Team | `[Team]` | Electric Indigo (`#6366f1`) |
| **Lay** | Core Team | `[Team]` | Vivid Purple (`#a855f7`) |
| **Vedant** | Core Team | `[Team]` | Emerald Green (`#10b981`) |
| **Bhumi** | Core Team | `[Team]` | Rose Pink (`#f43f5e`) |

---

## ✨ Key Features

- **Comprehensive Task Creation**:
  - Full metadata collection at creation time (Title, Today's Focus Star, Markdown Notes, Assigner & Assignee, Status, Priority, Project, Area, Due Date with presets, Start Date, Time Estimates, Tags/Contexts).
- **Two-Way Team Task Assignment**:
  - Track **who assigned the task** (`assignedBy`) and **who is responsible for execution** (`assignedTo`).
  - Interactive avatar badges showing `From: [Assigner] ➔ To: [Assignee]`.
- **GTD Workflow Engine**:
  - Inbox processing, Next Actions, Someday/Maybe, Waiting For, and Project planning.
- **Projects & Areas of Responsibility**:
  - Hierarchical project structures with progress metrics and deadlines.
- **Modern Graphionic Cyber Aesthetics**:
  - Ultra-crisp dark theme, glassmorphic panels, glowing status indicators, and smooth micro-interactions.

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.2+ recommended) or [Node.js](https://nodejs.org/) (v20+)

### Installation

```bash
# Clone the repository
git clone https://github.com/graphionic-infotech/Task_Management-.git
cd Task_Management-

# Install dependencies
bun install
```

### Running the Desktop Web App

```bash
# Start Vite development server
bun run dev:vite
```

The app will be accessible at `http://localhost:5173/`.

### Building for Production

```bash
# Typecheck
bun x tsc --noEmit

# Production build
bun run build
```

---

## 📁 Project Structure

```
├── apps/
│   ├── desktop/          # Graphionic desktop web application (Vite + React)
│   ├── mobile/           # Mobile client
│   └── mcp-server/       # Model Context Protocol integration
├── packages/
│   ├── core/             # Core business logic, types, sync normalization & team definitions
│   └── ...
└── config/               # Workspace configuration
```

---

© Graphionic Infotech. All rights reserved.
