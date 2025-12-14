# Chapter 4: Your First Tauri Application

## Learning Objectives

By the end of this chapter, you will:
- Create a complete Tauri application from scratch
- Implement backend commands in Rust
- Build a responsive UI with Tailwind CSS
- Handle user input and display data
- Manage application state
- Implement error handling
- Package your application for distribution
- Understand the complete development workflow

---

## 4.1 Project Overview: Building TaskMaster

We'll build **TaskMaster** - a simple task management application that demonstrates core Tauri concepts:

**Features:**
- Add, edit, and delete tasks
- Mark tasks as complete
- Filter tasks (all, active, completed)
- Persistent storage in JSON file
- Modern UI with Tailwind CSS
- Real-time updates

**Why This Project?**
- Covers all fundamental Tauri patterns
- Similar structure to QuickConnect
- Simple enough to understand completely
- Complex enough to be useful
- Can be extended with more features

### What You'll Learn

```
┌────────────────────────────────────────────────┐
│           TaskMaster Architecture              │
├────────────────────────────────────────────────┤
│                                                │
│  Frontend (TypeScript + Tailwind)             │
│  ├─ User input handling                       │
│  ├─ Task list rendering                       │
│  ├─ Filter controls                           │
│  └─ Real-time UI updates                      │
│                                                │
│  Backend (Rust)                               │
│  ├─ Task CRUD operations                      │
│  ├─ JSON file persistence                     │
│  ├─ Data validation                           │
│  └─ Error handling                            │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 4.2 Creating the Project

### Step 1: Initialize Tauri Project

Open PowerShell and create the project:

```powershell
# Navigate to your projects directory
cd C:\Projects

# Create new Tauri project
npm create tauri-app@latest

# Follow the prompts:
# ✔ Project name: taskmaster
# ✔ Choose which language to use for your frontend: TypeScript / JavaScript
# ✔ Choose your package manager: npm
# ✔ Choose your UI template: Vanilla
# ✔ Choose your UI flavor: TypeScript
```

### Step 2: Install Dependencies

```powershell
cd taskmaster
npm install

# Install Tailwind CSS and DaisyUI
npm install -D tailwindcss postcss autoprefixer daisyui

# Initialize Tailwind
npx tailwindcss init -p
```

### Step 3: Configure Tailwind CSS

Edit `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes: ["light", "dark", "cupcake", "dracula"],
  },
}
```

Update `src/style.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
body {
  margin: 0;
  padding: 0;
}
```

### Step 4: Verify Installation

```powershell
npm run tauri dev
```

You should see a window with the default Tauri template. If so, your environment is working!

---

## 4.3 Designing the Data Model

### Frontend Types (TypeScript)

Create `src/types.ts`:

```typescript
export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created_at: string;
}

export type FilterType = 'all' | 'active' | 'completed';

export interface AppState {
  tasks: Task[];
  filter: FilterType;
}
```

### Backend Types (Rust)

Edit `src-tauri/src/lib.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Task {
    id: String,
    title: String,
    description: String,
    completed: bool,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TaskList {
    tasks: Vec<Task>,
}
```

### Storage Strategy

We'll store tasks in a JSON file:
- Location: `%APPDATA%/TaskMaster/tasks.json`
- Format: Simple JSON array
- Auto-save on every change

```json
{
  "tasks": [
    {
      "id": "1234-5678-9012",
      "title": "Learn Tauri",
      "description": "Complete the TaskMaster tutorial",
      "completed": false,
      "created_at": "2025-11-22T10:30:00Z"
    }
  ]
}
```

---

## 4.4 Implementing Backend Commands

### File I/O Helpers

Add to `src-tauri/src/lib.rs`:

```rust
use std::fs;
use std::path::PathBuf;

fn get_data_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "Failed to get APPDATA directory".to_string())?;
    
    let app_dir = PathBuf::from(appdata).join("TaskMaster");
    
    // Create directory if it doesn't exist
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;
    
    Ok(app_dir)
}

fn get_tasks_file() -> Result<PathBuf, String> {
    Ok(get_data_dir()?.join("tasks.json"))
}

fn load_tasks() -> Result<TaskList, String> {
    let file_path = get_tasks_file()?;
    
    // If file doesn't exist, return empty list
    if !file_path.exists() {
        return Ok(TaskList { tasks: Vec::new() });
    }
    
    // Read and parse file
    let contents = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read tasks file: {}", e))?;
    
    let task_list: TaskList = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse tasks: {}", e))?;
    
    Ok(task_list)
}

fn save_tasks(task_list: &TaskList) -> Result<(), String> {
    let file_path = get_tasks_file()?;
    
    let json = serde_json::to_string_pretty(task_list)
        .map_err(|e| format!("Failed to serialize tasks: {}", e))?;
    
    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write tasks file: {}", e))?;
    
    Ok(())
}
```

### CRUD Commands

Add these commands to `src-tauri/src/lib.rs`:

```rust
use uuid::Uuid;
use chrono::Utc;

// Get all tasks
#[tauri::command]
fn get_tasks() -> Result<Vec<Task>, String> {
    let task_list = load_tasks()?;
    Ok(task_list.tasks)
}

// Create a new task
#[tauri::command]
fn create_task(title: String, description: String) -> Result<Task, String> {
    // Validate input
    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    
    if title.len() > 100 {
        return Err("Title too long (max 100 characters)".to_string());
    }
    
    if description.len() > 500 {
        return Err("Description too long (max 500 characters)".to_string());
    }
    
    // Create new task
    let task = Task {
        id: Uuid::new_v4().to_string(),
        title: title.trim().to_string(),
        description: description.trim().to_string(),
        completed: false,
        created_at: Utc::now().to_rfc3339(),
    };
    
    // Load existing tasks
    let mut task_list = load_tasks()?;
    
    // Add new task
    task_list.tasks.push(task.clone());
    
    // Save
    save_tasks(&task_list)?;
    
    Ok(task)
}

// Update a task
#[tauri::command]
fn update_task(id: String, title: String, description: String, completed: bool) -> Result<Task, String> {
    // Validate
    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    
    let mut task_list = load_tasks()?;
    
    // Find task
    let task = task_list.tasks.iter_mut()
        .find(|t| t.id == id)
        .ok_or("Task not found".to_string())?;
    
    // Update fields
    task.title = title.trim().to_string();
    task.description = description.trim().to_string();
    task.completed = completed;
    
    let updated_task = task.clone();
    
    // Save
    save_tasks(&task_list)?;
    
    Ok(updated_task)
}

// Toggle task completion
#[tauri::command]
fn toggle_task(id: String) -> Result<Task, String> {
    let mut task_list = load_tasks()?;
    
    let task = task_list.tasks.iter_mut()
        .find(|t| t.id == id)
        .ok_or("Task not found".to_string())?;
    
    task.completed = !task.completed;
    let updated_task = task.clone();
    
    save_tasks(&task_list)?;
    
    Ok(updated_task)
}

// Delete a task
#[tauri::command]
fn delete_task(id: String) -> Result<(), String> {
    let mut task_list = load_tasks()?;
    
    // Find and remove
    let initial_len = task_list.tasks.len();
    task_list.tasks.retain(|t| t.id != id);
    
    if task_list.tasks.len() == initial_len {
        return Err("Task not found".to_string());
    }
    
    save_tasks(&task_list)?;
    
    Ok(())
}

// Delete all completed tasks
#[tauri::command]
fn clear_completed() -> Result<usize, String> {
    let mut task_list = load_tasks()?;
    
    let initial_len = task_list.tasks.len();
    task_list.tasks.retain(|t| !t.completed);
    let deleted_count = initial_len - task_list.tasks.len();
    
    save_tasks(&task_list)?;
    
    Ok(deleted_count)
}
```

### Register Commands

Update the `run` function in `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_tasks,
            create_task,
            update_task,
            toggle_task,
            delete_task,
            clear_completed,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Add Dependencies

**What are dependencies?** Think of them as pre-built tools you can use. Instead of building a hammer from scratch, you go to the store (crates.io) and get one.

Edit `src-tauri/Cargo.toml` to add required crates:

```toml
[dependencies]
tauri = { version = "2", features = [] }     # The Tauri framework itself
tauri-plugin-shell = "2"                     # Run system commands
serde = { version = "1", features = ["derive"] }  # Convert between Rust and JSON
serde_json = "1.0"                           # Work with JSON format
uuid = { version = "1.6", features = ["v4"] }     # Generate unique IDs (like "abc-123-def")
chrono = "0.4"                               # Handle dates and times
```

**What each does:**
- **serde/serde_json**: Remember "serialization"? These pack/unpack data for sending between frontend and backend
- **uuid**: Creates unique IDs. Like giving each task a Social Security Number - no two are the same
- **chrono**: Handles timestamps. Like a clock that knows timezones and can format dates nicely

---

## 4.5 Building the Frontend UI

### Main HTML Structure

Replace `index.html`:

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/src/style.css" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TaskMaster</title>
    <script type="module" src="/src/main.ts" defer></script>
  </head>
  <body class="min-h-screen bg-base-100">
    <div class="container mx-auto p-4 max-w-4xl">
      <!-- Header -->
      <div class="navbar bg-base-200 rounded-lg mb-4">
        <div class="flex-1">
          <h1 class="text-2xl font-bold">📝 TaskMaster</h1>
        </div>
        <div class="flex-none">
          <button id="theme-toggle" class="btn btn-ghost btn-circle">
            🌓
          </button>
        </div>
      </div>

      <!-- Add Task Form -->
      <div class="card bg-base-200 shadow-xl mb-4">
        <div class="card-body">
          <h2 class="card-title">Add New Task</h2>
          <form id="add-task-form" class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Title</span>
              </label>
              <input
                type="text"
                id="task-title"
                placeholder="Enter task title"
                class="input input-bordered"
                required
                maxlength="100"
              />
            </div>
            <div class="form-control">
              <label class="label">
                <span class="label-text">Description</span>
              </label>
              <textarea
                id="task-description"
                placeholder="Enter task description (optional)"
                class="textarea textarea-bordered"
                rows="3"
                maxlength="500"
              ></textarea>
            </div>
            <div class="card-actions justify-end">
              <button type="submit" class="btn btn-primary">Add Task</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Filters -->
      <div class="btn-group w-full mb-4">
        <button class="btn btn-active flex-1" data-filter="all">
          All Tasks
        </button>
        <button class="btn flex-1" data-filter="active">
          Active
        </button>
        <button class="btn flex-1" data-filter="completed">
          Completed
        </button>
      </div>

      <!-- Task Stats -->
      <div class="stats shadow w-full mb-4">
        <div class="stat">
          <div class="stat-title">Total Tasks</div>
          <div class="stat-value" id="total-tasks">0</div>
        </div>
        <div class="stat">
          <div class="stat-title">Active</div>
          <div class="stat-value text-primary" id="active-tasks">0</div>
        </div>
        <div class="stat">
          <div class="stat-title">Completed</div>
          <div class="stat-value text-success" id="completed-tasks">0</div>
        </div>
      </div>

      <!-- Task List -->
      <div id="task-list" class="space-y-2">
        <!-- Tasks will be inserted here -->
      </div>

      <!-- Empty State -->
      <div id="empty-state" class="text-center py-12 hidden">
        <div class="text-6xl mb-4">📋</div>
        <h3 class="text-xl font-semibold mb-2">No tasks yet</h3>
        <p class="text-base-content/70">Add your first task to get started!</p>
      </div>

      <!-- Clear Completed Button -->
      <div class="mt-4 flex justify-center">
        <button id="clear-completed" class="btn btn-error btn-sm" style="display: none;">
          Clear Completed Tasks
        </button>
      </div>
    </div>

    <!-- Edit Task Modal -->
    <dialog id="edit-modal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Edit Task</h3>
        <form id="edit-task-form" class="space-y-4">
          <input type="hidden" id="edit-task-id" />
          <div class="form-control">
            <label class="label">
              <span class="label-text">Title</span>
            </label>
            <input
              type="text"
              id="edit-task-title"
              class="input input-bordered"
              required
              maxlength="100"
            />
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text">Description</span>
            </label>
            <textarea
              id="edit-task-description"
              class="textarea textarea-bordered"
              rows="3"
              maxlength="500"
            ></textarea>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">Completed</span>
              <input type="checkbox" id="edit-task-completed" class="checkbox" />
            </label>
          </div>
          <div class="modal-action">
            <button type="button" class="btn" onclick="edit_modal.close()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </body>
</html>
```

---

## 4.6 Implementing Frontend Logic

Replace `src/main.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { Task, FilterType } from "./types";

// State
let tasks: Task[] = [];
let currentFilter: FilterType = 'all';

// Theme Management
function initializeTheme() {
  const themeToggle = document.getElementById("theme-toggle");
  const html = document.documentElement;
  
  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem("theme") || "dark";
  html.setAttribute("data-theme", savedTheme);
  
  themeToggle?.addEventListener("click", () => {
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });
}

// Load tasks from backend
async function loadTasks() {
  try {
    tasks = await invoke<Task[]>("get_tasks");
    renderTasks();
    updateStats();
  } catch (error) {
    console.error("Failed to load tasks:", error);
    showNotification("Failed to load tasks", "error");
  }
}

// Render tasks based on current filter
function renderTasks() {
  const taskList = document.getElementById("task-list");
  const emptyState = document.getElementById("empty-state");
  
  if (!taskList || !emptyState) return;
  
  // Filter tasks
  let filteredTasks = tasks;
  if (currentFilter === 'active') {
    filteredTasks = tasks.filter(t => !t.completed);
  } else if (currentFilter === 'completed') {
    filteredTasks = tasks.filter(t => t.completed);
  }
  
  // Show empty state if no tasks
  if (filteredTasks.length === 0) {
    taskList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Render tasks
  taskList.innerHTML = filteredTasks.map(task => `
    <div class="card bg-base-200 shadow-sm" data-task-id="${task.id}">
      <div class="card-body py-3 px-4">
        <div class="flex items-start gap-3">
          <!-- Checkbox -->
          <input
            type="checkbox"
            class="checkbox checkbox-primary mt-1"
            ${task.completed ? 'checked' : ''}
            onchange="window.toggleTask('${task.id}')"
          />
          
          <!-- Task Content -->
          <div class="flex-1">
            <h3 class="font-semibold ${task.completed ? 'line-through opacity-60' : ''}">
              ${escapeHtml(task.title)}
            </h3>
            ${task.description ? `
              <p class="text-sm text-base-content/70 mt-1 ${task.completed ? 'line-through opacity-60' : ''}">
                ${escapeHtml(task.description)}
              </p>
            ` : ''}
            <p class="text-xs text-base-content/50 mt-1">
              ${formatDate(task.created_at)}
            </p>
          </div>
          
          <!-- Actions -->
          <div class="flex gap-2">
            <button
              class="btn btn-ghost btn-sm btn-square"
              onclick="window.editTask('${task.id}')"
              title="Edit"
            >
              ✏️
            </button>
            <button
              class="btn btn-ghost btn-sm btn-square text-error"
              onclick="window.deleteTask('${task.id}')"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// Update statistics
function updateStats() {
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter(t => !t.completed).length;
  const completedTasks = tasks.filter(t => t.completed).length;
  
  const totalEl = document.getElementById("total-tasks");
  const activeEl = document.getElementById("active-tasks");
  const completedEl = document.getElementById("completed-tasks");
  const clearBtn = document.getElementById("clear-completed");
  
  if (totalEl) totalEl.textContent = totalTasks.toString();
  if (activeEl) activeEl.textContent = activeTasks.toString();
  if (completedEl) completedEl.textContent = completedTasks.toString();
  
  // Show/hide clear completed button
  if (clearBtn) {
    clearBtn.style.display = completedTasks > 0 ? 'block' : 'none';
  }
}

// Add new task
async function addTask(title: string, description: string) {
  try {
    const newTask = await invoke<Task>("create_task", { title, description });
    tasks.push(newTask);
    renderTasks();
    updateStats();
    showNotification("Task added successfully", "success");
  } catch (error) {
    console.error("Failed to add task:", error);
    showNotification(String(error), "error");
  }
}

// Toggle task completion
window.toggleTask = async function(id: string) {
  try {
    const updatedTask = await invoke<Task>("toggle_task", { id });
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index] = updatedTask;
      renderTasks();
      updateStats();
    }
  } catch (error) {
    console.error("Failed to toggle task:", error);
    showNotification(String(error), "error");
  }
};

// Edit task
window.editTask = function(id: string) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  
  const modal = document.getElementById("edit-modal") as HTMLDialogElement;
  const idInput = document.getElementById("edit-task-id") as HTMLInputElement;
  const titleInput = document.getElementById("edit-task-title") as HTMLInputElement;
  const descInput = document.getElementById("edit-task-description") as HTMLTextAreaElement;
  const completedInput = document.getElementById("edit-task-completed") as HTMLInputElement;
  
  if (modal && idInput && titleInput && descInput && completedInput) {
    idInput.value = task.id;
    titleInput.value = task.title;
    descInput.value = task.description;
    completedInput.checked = task.completed;
    modal.showModal();
  }
};

// Delete task
window.deleteTask = async function(id: string) {
  // Note: Production apps use custom dialogs (see Chapter 5 showCustomDialog)
  const confirmed = confirm("Are you sure you want to delete this task?");
  if (!confirmed) return;
  
  try {
    await invoke("delete_task", { id });
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
    updateStats();
    showNotification("Task deleted", "success");
  } catch (error) {
    console.error("Failed to delete task:", error);
    showNotification(String(error), "error");
  }
};

// Utility functions
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  
  return date.toLocaleDateString();
}

function showNotification(message: string, type: 'success' | 'error') {
  const notification = document.createElement('div');
  notification.className = `alert alert-${type === 'success' ? 'success' : 'error'} fixed top-4 right-4 w-auto max-w-sm shadow-lg z-50`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Event Listeners
document.addEventListener("DOMContentLoaded", async () => {
  initializeTheme();
  await loadTasks();
  
  // Add task form
  const addForm = document.getElementById("add-task-form");
  addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const titleInput = document.getElementById("task-title") as HTMLInputElement;
    const descInput = document.getElementById("task-description") as HTMLTextAreaElement;
    
    if (titleInput && descInput) {
      await addTask(titleInput.value, descInput.value);
      titleInput.value = '';
      descInput.value = '';
    }
  });
  
  // Edit task form
  const editForm = document.getElementById("edit-task-form");
  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const idInput = document.getElementById("edit-task-id") as HTMLInputElement;
    const titleInput = document.getElementById("edit-task-title") as HTMLInputElement;
    const descInput = document.getElementById("edit-task-description") as HTMLTextAreaElement;
    const completedInput = document.getElementById("edit-task-completed") as HTMLInputElement;
    
    if (idInput && titleInput && descInput && completedInput) {
      try {
        const updatedTask = await invoke<Task>("update_task", {
          id: idInput.value,
          title: titleInput.value,
          description: descInput.value,
          completed: completedInput.checked,
        });
        
        const index = tasks.findIndex(t => t.id === idInput.value);
        if (index !== -1) {
          tasks[index] = updatedTask;
          renderTasks();
          updateStats();
        }
        
        const modal = document.getElementById("edit-modal") as HTMLDialogElement;
        modal?.close();
        
        showNotification("Task updated", "success");
      } catch (error) {
        console.error("Failed to update task:", error);
        showNotification(String(error), "error");
      }
    }
  });
  
  // Filter buttons
  const filterButtons = document.querySelectorAll("[data-filter]");
  filterButtons.forEach(button => {
    button.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const filter = target.getAttribute("data-filter") as FilterType;
      
      currentFilter = filter;
      
      // Update active state
      filterButtons.forEach(btn => btn.classList.remove("btn-active"));
      target.classList.add("btn-active");
      
      renderTasks();
    });
  });
  
  // Clear completed button
  const clearBtn = document.getElementById("clear-completed");
  clearBtn?.addEventListener("click", async () => {
    // Note: Production apps use showCustomDialog (covered in Chapter 5)
    const confirmed = confirm("Delete all completed tasks?");
    if (!confirmed) return;
    
    try {
      const count = await invoke<number>("clear_completed");
      tasks = tasks.filter(t => !t.completed);
      renderTasks();
      updateStats();
      showNotification(`Deleted ${count} completed task(s)`, "success");
    } catch (error) {
      console.error("Failed to clear completed:", error);
      showNotification(String(error), "error");
    }
  });
});

// Global functions for onclick handlers
declare global {
  interface Window {
    toggleTask: (id: string) => Promise<void>;
    editTask: (id: string) => void;
    deleteTask: (id: string) => Promise<void>;
  }
}
```

Create `src/types.ts`:

```typescript
export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created_at: string;
}

export type FilterType = 'all' | 'active' | 'completed';
```

---

## 4.7 Testing the Application

### Run in Development Mode

```powershell
npm run tauri dev
```

**Test Checklist:**
1. ✅ Add a task with title and description
2. ✅ Add a task with only a title
3. ✅ Mark a task as complete
4. ✅ Edit a task
5. ✅ Delete a task
6. ✅ Filter by active/completed
7. ✅ Clear all completed tasks
8. ✅ Toggle theme (light/dark)
9. ✅ Close and reopen app (data should persist)
10. ✅ Try to add task with empty title (should show error)

### Common Issues and Fixes

**Issue: Tasks don't persist after restart**
```rust
// Check that save_tasks is being called
fn save_tasks(task_list: &TaskList) -> Result<(), String> {
    println!("Saving to: {:?}", get_tasks_file()?);  // Debug
    // ... rest of code
}
```

**Issue: Checkbox doesn't update**
```typescript
// Make sure function is global
window.toggleTask = async function(id: string) {
  // ...
};
```

**Issue: Modal doesn't close after edit**
```typescript
const modal = document.getElementById("edit-modal") as HTMLDialogElement;
modal?.close();  // Don't forget this!
```

---

## 4.8 Building for Production

### Step 1: Build the Application

```powershell
npm run tauri build
```

This will:
1. Build optimized frontend (minified, bundled)
2. Compile Rust in release mode
3. Create installer in `src-tauri/target/release/bundle/`

### Step 2: Find Your Installer

```powershell
# NSIS installer (recommended)
ls src-tauri\target\release\bundle\nsis\

# MSI installer
ls src-tauri\target\release\bundle\msi\
```

### Step 3: Test the Installer

1. Run the `.exe` installer
2. Install TaskMaster
3. Launch from Start Menu
4. Verify all features work
5. Check that data persists

### Build Configuration

The release build is optimized in `src-tauri/Cargo.toml`:

```toml
[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link Time Optimization
codegen-units = 1   # Better optimization
panic = "abort"     # Smaller binary
strip = true        # Remove debug symbols
```

**Results:**
- Binary size: ~8-12 MB
- Startup time: <0.5 seconds
- Memory usage: ~30-40 MB

---

## 4.9 Enhancing the Application

### Adding Search

**Backend:**
```rust
#[tauri::command]
fn search_tasks(query: String) -> Result<Vec<Task>, String> {
    let task_list = load_tasks()?;
    let query_lower = query.to_lowercase();
    
    let filtered: Vec<Task> = task_list.tasks
        .into_iter()
        .filter(|task| {
            task.title.to_lowercase().contains(&query_lower) ||
            task.description.to_lowercase().contains(&query_lower)
        })
        .collect();
    
    Ok(filtered)
}
```

**Frontend:**
```typescript
// Add search input to HTML
<input
  type="text"
  id="search-input"
  placeholder="Search tasks..."
  class="input input-bordered w-full"
/>

// Add search handler
const searchInput = document.getElementById("search-input");
searchInput?.addEventListener("input", async (e) => {
  const query = (e.target as HTMLInputElement).value;
  
  if (query.trim()) {
    tasks = await invoke<Task[]>("search_tasks", { query });
  } else {
    await loadTasks();
  }
  
  renderTasks();
});
```

### Adding Categories

**Backend:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Task {
    id: String,
    title: String,
    description: String,
    completed: bool,
    created_at: String,
    category: Option<String>,  // Add this
}

#[tauri::command]
fn get_tasks_by_category(category: String) -> Result<Vec<Task>, String> {
    let task_list = load_tasks()?;
    
    let filtered: Vec<Task> = task_list.tasks
        .into_iter()
        .filter(|task| {
            task.category.as_ref()
                .map(|c| c == &category)
                .unwrap_or(false)
        })
        .collect();
    
    Ok(filtered)
}
```

### Adding Due Dates

**Backend:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Task {
    // ... existing fields
    due_date: Option<String>,
}

#[tauri::command]
fn get_overdue_tasks() -> Result<Vec<Task>, String> {
    use chrono::{DateTime, Utc};
    
    let task_list = load_tasks()?;
    let now = Utc::now();
    
    let overdue: Vec<Task> = task_list.tasks
        .into_iter()
        .filter(|task| {
            if let Some(due_date) = &task.due_date {
                if let Ok(due) = DateTime::parse_from_rfc3339(due_date) {
                    return due < now.into() && !task.completed;
                }
            }
            false
        })
        .collect();
    
    Ok(overdue)
}
```

---

## 4.10 Comparing TaskMaster to QuickConnect

Let's see how our simple app relates to QuickConnect:

| Feature | TaskMaster | QuickConnect |
|---------|-----------|----------|
| **Data Model** | Task (id, title, desc) | Host (hostname, desc, credentials) |
| **Storage** | JSON file | CSV file + Windows Credential Manager |
| **CRUD** | Create/Read/Update/Delete | Create/Read/Update/Delete |
| **Windows Integration** | Basic file I/O | Credential Manager, ShellExecute, Registry |
| **Multi-Window** | Single window | 5 windows (login, main, hosts, about, error) |
| **Network** | None | LDAP for AD scanning |
| **Security** | File permissions | Windows Credential Manager encryption |
| **UI Framework** | Tailwind + DaisyUI | Tailwind + DaisyUI |
| **Complexity** | Beginner | Intermediate |

**What TaskMaster Teaches:**
- ✅ Basic Tauri structure
- ✅ IPC commands
- ✅ File persistence
- ✅ Error handling
- ✅ UI patterns

**What QuickConnect Adds:**
- Windows API integration
- Multi-window management
- System tray
- Global shortcuts
- Advanced security

---

## 4.11 Key Takeaways

✅ **Complete workflow mastered**
- Created project from scratch
- Implemented backend in Rust
- Built frontend with TypeScript
- Packaged for distribution

✅ **Core Tauri patterns learned**
- CRUD operations via commands
- Data persistence in files
- Input validation
- Error handling
- UI state management

✅ **Real-world application built**
- Functional task manager
- Responsive UI with Tailwind
- Theme switching
- Data filtering
- Production-ready

✅ **Foundation for complex apps**
- Same patterns scale to bigger projects
- QuickConnect uses identical structure
- Ready to add advanced features

---

## 4.12 Practice Exercises

### Exercise 1: Add Task Priority

Add a priority system (High, Medium, Low):

```rust
// TODO: Backend
#[derive(Debug, Clone, Serialize, Deserialize)]
enum Priority {
    High,
    Medium,
    Low,
}

// Update Task struct
// Update create/update commands
// Add sort_by_priority command
```

```typescript
// TODO: Frontend
// Add priority dropdown in forms
// Display priority with colored badges
// Add "Sort by Priority" button
```

### Exercise 2: Task Statistics

Add a statistics page:

```rust
// TODO: Backend
#[derive(Serialize)]
struct TaskStats {
    total: usize,
    completed: usize,
    active: usize,
    completion_rate: f64,
    tasks_by_day: Vec<(String, usize)>,
}

#[tauri::command]
fn get_task_stats() -> Result<TaskStats, String> {
    // Calculate statistics
}
```

### Exercise 3: Export/Import

Add ability to export and import tasks:

```rust
// TODO: Backend
#[tauri::command]
fn export_tasks(path: String) -> Result<(), String> {
    // Export to CSV or JSON
}

#[tauri::command]
fn import_tasks(path: String) -> Result<usize, String> {
    // Import from file
    // Return number of imported tasks
}
```

### Exercise 4: Task Reminders

Add desktop notifications for due tasks:

```rust
// TODO: Backend
use tauri::Manager;

#[tauri::command]
fn check_reminders(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Find tasks due soon
    // Emit notification events
}
```

```typescript
// TODO: Frontend
// Listen for reminder events
// Show browser notifications
// Add "Snooze" functionality
```

### Exercise 5: Keyboard Shortcuts

Add keyboard shortcuts:

```typescript
// TODO: Frontend
document.addEventListener("keydown", (e) => {
  // Ctrl+N: New task
  // Ctrl+F: Focus search
  // Delete: Delete selected task
  // Space: Toggle selected task
});
```

---

## Solutions

<details>
<summary>Click to reveal solutions</summary>

### Solution 1: Add Task Priority

**Backend:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
enum Priority {
    Low = 1,
    Medium = 2,
    High = 3,
}

impl Default for Priority {
    fn default() -> Self {
        Priority::Medium
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Task {
    id: String,
    title: String,
    description: String,
    completed: bool,
    created_at: String,
    priority: Priority,
}

#[tauri::command]
fn create_task(title: String, description: String, priority: Priority) -> Result<Task, String> {
    let task = Task {
        id: Uuid::new_v4().to_string(),
        title: title.trim().to_string(),
        description: description.trim().to_string(),
        completed: false,
        created_at: Utc::now().to_rfc3339(),
        priority,
    };
    
    let mut task_list = load_tasks()?;
    task_list.tasks.push(task.clone());
    save_tasks(&task_list)?;
    
    Ok(task)
}

#[tauri::command]
fn get_tasks_sorted() -> Result<Vec<Task>, String> {
    let mut task_list = load_tasks()?;
    
    // Sort by priority (High first) then by created date
    task_list.tasks.sort_by(|a, b| {
        b.priority.cmp(&a.priority)
            .then_with(|| a.created_at.cmp(&b.created_at))
    });
    
    Ok(task_list.tasks)
}
```

**Frontend:**
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created_at: string;
  priority: 'Low' | 'Medium' | 'High';
}

// Add to form
<select id="task-priority" class="select select-bordered">
  <option value="Low">Low Priority</option>
  <option value="Medium" selected>Medium Priority</option>
  <option value="High">High Priority</option>
</select>

// Render with badge
function getPriorityBadge(priority: string): string {
  const colors = {
    High: 'badge-error',
    Medium: 'badge-warning',
    Low: 'badge-success',
  };
  return `<span class="badge ${colors[priority]}">${priority}</span>`;
}
```

### Solution 2: Task Statistics

**Backend:**
```rust
use std::collections::HashMap;

#[derive(Serialize)]
struct TaskStats {
    total: usize,
    completed: usize,
    active: usize,
    completion_rate: f64,
    tasks_by_day: Vec<(String, usize)>,
    average_completion_time: Option<f64>,
}

#[tauri::command]
fn get_task_stats() -> Result<TaskStats, String> {
    let task_list = load_tasks()?;
    let total = task_list.tasks.len();
    let completed = task_list.tasks.iter().filter(|t| t.completed).count();
    let active = total - completed;
    let completion_rate = if total > 0 {
        (completed as f64 / total as f64) * 100.0
    } else {
        0.0
    };
    
    // Tasks by day
    let mut by_day: HashMap<String, usize> = HashMap::new();
    for task in &task_list.tasks {
        if let Ok(date) = chrono::DateTime::parse_from_rfc3339(&task.created_at) {
            let day = date.format("%Y-%m-%d").to_string();
            *by_day.entry(day).or_insert(0) += 1;
        }
    }
    
    let mut tasks_by_day: Vec<(String, usize)> = by_day.into_iter().collect();
    tasks_by_day.sort_by(|a, b| a.0.cmp(&b.0));
    
    Ok(TaskStats {
        total,
        completed,
        active,
        completion_rate,
        tasks_by_day,
        average_completion_time: None, // Could calculate from completion timestamps
    })
}
```

### Solution 3: Export/Import

**Backend:**
```rust
use std::path::Path;

#[tauri::command]
fn export_tasks(path: String) -> Result<(), String> {
    let task_list = load_tasks()?;
    
    // Validate path
    let export_path = Path::new(&path);
    if export_path.exists() {
        return Err("File already exists".to_string());
    }
    
    // Export as JSON
    let json = serde_json::to_string_pretty(&task_list)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    
    std::fs::write(export_path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn import_tasks(path: String) -> Result<usize, String> {
    // Read file
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Parse
    let imported: TaskList = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    // Merge with existing
    let mut existing = load_tasks()?;
    let import_count = imported.tasks.len();
    
    // Assign new IDs to avoid conflicts
    let mut new_tasks = imported.tasks;
    for task in &mut new_tasks {
        task.id = Uuid::new_v4().to_string();
    }
    
    existing.tasks.extend(new_tasks);
    save_tasks(&existing)?;
    
    Ok(import_count)
}
```

### Solution 4: Task Reminders

**Backend:**
```rust
#[tauri::command]
async fn check_reminders(app_handle: tauri::AppHandle) -> Result<(), String> {
    let task_list = load_tasks()?;
    let now = Utc::now();
    
    for task in task_list.tasks {
        if task.completed {
            continue;
        }
        
        if let Some(due_date) = &task.due_date {
            if let Ok(due) = DateTime::parse_from_rfc3339(due_date) {
                let diff = due.signed_duration_since(now);
                
                // Remind if due within 1 hour
                if diff.num_minutes() > 0 && diff.num_minutes() <= 60 {
                    app_handle.emit("task-reminder", ReminderPayload {
                        task_id: task.id.clone(),
                        title: task.title.clone(),
                        minutes_until_due: diff.num_minutes(),
                    }).ok();
                }
            }
        }
    }
    
    Ok(())
}

#[derive(Clone, Serialize)]
struct ReminderPayload {
    task_id: String,
    title: String,
    minutes_until_due: i64,
}
```

**Frontend:**
```typescript
import { listen } from '@tauri-apps/api/event';

interface ReminderPayload {
  task_id: string;
  title: string;
  minutes_until_due: number;
}

await listen<ReminderPayload>('task-reminder', (event) => {
  const { title, minutes_until_due } = event.payload;
  
  // Show browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Task Reminder', {
      body: `"${title}" is due in ${minutes_until_due} minutes`,
      icon: '/icon.png',
    });
  }
});

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Check reminders every 5 minutes
setInterval(async () => {
  await invoke('check_reminders');
}, 5 * 60 * 1000);
```

### Solution 5: Keyboard Shortcuts

**Frontend:**
```typescript
document.addEventListener("keydown", (e) => {
  // Ctrl+N: New task
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    const titleInput = document.getElementById('task-title') as HTMLInputElement;
    titleInput?.focus();
  }
  
  // Ctrl+F: Focus search
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault();
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.focus();
  }
  
  // Escape: Clear search
  if (e.key === 'Escape') {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput && searchInput === document.activeElement) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }
  }
});

// Add visual hint
<div class="text-xs text-base-content/50 mt-2">
  <kbd class="kbd kbd-sm">Ctrl</kbd> + <kbd class="kbd kbd-sm">N</kbd> New Task
  <span class="mx-2">•</span>
  <kbd class="kbd kbd-sm">Ctrl</kbd> + <kbd class="kbd kbd-sm">F</kbd> Search
</div>
```

</details>

---

## Next Steps

In **Chapter 5: TypeScript and Frontend Basics**, we'll dive deeper into:
- TypeScript best practices for Tauri
- Advanced type definitions
- State management patterns
- Reactive UI updates
- Component architecture
- Testing frontend code

**You've now built your first complete Tauri application!** 🎉

The skills learned here directly transfer to building applications like QuickConnect. You understand the complete workflow from backend commands to frontend UI.

---

## Additional Resources

- [Tauri API Documentation](https://tauri.app/v1/api/js/) - Complete JS/TS API reference
- [DaisyUI Components](https://daisyui.com/components/) - UI component library
- [Tailwind CSS](https://tailwindcss.com/docs) - Utility-first CSS
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript guide
- [TaskMaster Source Code](https://github.com/Swatto86/taskmaster) - Complete example

