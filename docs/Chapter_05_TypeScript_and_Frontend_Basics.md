# Chapter 5: TypeScript and Frontend Basics

## Learning Objectives

By the end of this chapter, you will:
- Understand TypeScript's advantages in Tauri applications
- Define type-safe interfaces matching Rust structs
- Work confidently with the Tauri API
- Handle async operations effectively
- Implement event-driven patterns
- Structure frontend code professionally
- Analyze QuickConnect's frontend architecture
- Write maintainable, type-safe code

---

## 5.1 TypeScript vs JavaScript in Tauri

### Why TypeScript Matters

In Tauri applications, TypeScript provides critical benefits:

**1. Type Safety Across the IPC Bridge**
```typescript
// JavaScript - Runtime errors waiting to happen
invoke("create_task", { 
  title: 123,              // Wrong type!
  description: true,       // Wrong type!
  priority: "Super High"   // Invalid value!
}).then(task => {
  console.log(task.titel); // Typo! No error until runtime
});

// TypeScript - Caught at compile time
interface CreateTaskParams {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
}

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created_at: string;
  priority: 'Low' | 'Medium' | 'High';
}

invoke<Task>("create_task", {
  title: 123,              // ❌ Error: Type 'number' not assignable to type 'string'
  description: true,       // ❌ Error: Type 'boolean' not assignable to type 'string'
  priority: "Super High"   // ❌ Error: Not assignable to union type
} as CreateTaskParams).then(task => {
  console.log(task.titel); // ❌ Error: Property 'titel' does not exist
});
```

**2. IntelliSense and Autocomplete**
```typescript
// With TypeScript, your IDE knows:
task. // ← Shows: id, title, description, completed, created_at, priority
     // ← No guessing, no documentation lookup needed
```

**3. Refactoring Confidence**
```typescript
// Rename interface property
interface Task {
  title: string;        // Rename to 'name'
  // ... rest
}

// TypeScript shows ALL locations that need updates
// JavaScript? Silent breakage everywhere
```

**4. Self-Documenting Code**
```typescript
// This function signature tells you everything:
async function updateTask(
  id: string,
  updates: Partial<Task>
): Promise<Task | null>

// JavaScript equivalent:
async function updateTask(id, updates) {
  // What types? What can 'updates' contain? What does it return?
  // You have to read the implementation or docs
}
```

### When JavaScript Is Acceptable

TypeScript isn't always necessary:
- ✅ Quick prototypes and demos
- ✅ Very small single-file scripts
- ✅ Learning basic concepts

For production Tauri apps (like QuickConnect), TypeScript is essential.

---

## 5.2 Setting Up TypeScript in Tauri

### Project Configuration

When you create a Tauri project with TypeScript:

**`tsconfig.json`** (generated automatically):
```json
{
  "compilerOptions": {
    "target": "ES2020",                // Modern JavaScript features
    "useDefineForClassFields": true,
    "module": "ESNext",                // ES modules
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,                    // Vite handles compilation

    /* Linting */
    "strict": true,                    // Enable all strict checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

**Key Settings Explained:**

```typescript
// "strict": true enables these critical checks:

// 1. No implicit 'any'
function processData(data) {        // ❌ Error: Parameter 'data' implicitly has 'any' type
  return data.value;
}

function processData(data: unknown) { // ✅ Explicit type required
  return data.value;                  // ❌ Error: Object is of type 'unknown'
}

// 2. Strict null checks
let name: string = null;              // ❌ Error: Type 'null' not assignable
let name: string | null = null;       // ✅ Explicitly allow null

// 3. Strict function types
type Callback = (x: string) => void;
let fn: Callback = (x: string | number) => {}; // ❌ Error: Parameter types incompatible
```

### Installing Tauri Types

```powershell
npm install --save-dev @tauri-apps/api
```

This provides TypeScript definitions for:
- `invoke()` - Call Rust commands
- `listen()` - Subscribe to events
- Window management
- File system APIs
- Dialog APIs
- And more...

---

## 5.3 Type Definitions Matching Rust

### The Golden Rule

**Frontend TypeScript types must match Backend Rust types exactly.**

### Simple Example

**Rust (`src-tauri/src/lib.rs`):**
```rust
#[derive(Serialize, Deserialize)]
struct User {
    id: u32,
    username: String,
    email: String,
    is_active: bool,
}
```

**TypeScript (`src/types.ts`):**
```typescript
export interface User {
  id: number;          // Rust u32 → TypeScript number
  username: string;    // Rust String → TypeScript string
  email: string;
  is_active: boolean;  // Rust bool → TypeScript boolean
}
```

### Type Mapping Reference

| Rust Type | TypeScript Type | Notes |
|-----------|-----------------|-------|
| `String` | `string` | UTF-8 strings |
| `&str` | `string` | Borrowed strings |
| `i32`, `u32`, `i64`, `f64` | `number` | All numeric types |
| `bool` | `boolean` | Boolean values |
| `Vec<T>` | `T[]` or `Array<T>` | Arrays |
| `Option<T>` | `T \| null` or `T \| undefined` | Optional values |
| `HashMap<K, V>` | `Record<K, V>` or `Map<K, V>` | Key-value pairs |
| `()` | `void` | No return value |
| Custom struct | `interface` | Complex types |
| `enum` | `type` union | Enum variants |

### Complex Example: QuickConnect Host

**Rust:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Host {
    pub hostname: String,
    pub description: String,
    pub username: String,
    pub domain: String,
    pub created: String,
    pub modified: String,
    pub credential_target: Option<String>,
}
```

**TypeScript:**
```typescript
export interface Host {
  hostname: string;
  description: string;
  username: string;
  domain: string;
  created: string;      // ISO 8601 date string
  modified: string;
  credential_target: string | null;  // Option<String> → string | null
}
```

### Enum Mapping

**Rust:**
```rust
#[derive(Serialize, Deserialize)]
enum TaskStatus {
    Pending,
    InProgress,
    Completed,
    Cancelled,
}
```

**TypeScript (Union Type):**
```typescript
export type TaskStatus = 
  | 'Pending'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled';

// Usage
const status: TaskStatus = 'Pending';     // ✅
const invalid: TaskStatus = 'Unknown';    // ❌ Error
```

**Rust (with data):**
```rust
#[derive(Serialize, Deserialize)]
enum ApiResponse {
    Success { data: String },
    Error { code: i32, message: String },
}
```

**TypeScript (Discriminated Union):**
```typescript
export type ApiResponse =
  | { type: 'Success'; data: string }
  | { type: 'Error'; code: number; message: string };

// Type-safe handling
function handleResponse(response: ApiResponse) {
  if (response.type === 'Success') {
    console.log(response.data);    // TypeScript knows 'data' exists
  } else {
    console.error(response.message); // TypeScript knows 'message' exists
  }
}
```

### Result<T, E> Pattern

**Rust:**
```rust
#[tauri::command]
fn get_user(id: u32) -> Result<User, String> {
    // Returns Ok(user) or Err(error_message)
}
```

**TypeScript (invoke handles this):**
```typescript
// Success case: invoke returns T
const user = await invoke<User>('get_user', { id: 42 });
console.log(user.username);

// Error case: invoke throws exception
try {
  const user = await invoke<User>('get_user', { id: 999 });
} catch (error) {
  console.error('Failed to get user:', error); // Error is the String
}
```

---

## 5.4 Working with the Tauri API

### Importing Tauri Functions

```typescript
// Import specific functions
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
```

### invoke() - Calling Rust Commands

**Basic Usage:**
```typescript
// No parameters, no return value
await invoke('log_message');

// With parameters
await invoke('create_file', { 
  path: 'C:\\temp\\test.txt',
  contents: 'Hello, World!'
});

// With return value
const result = await invoke<string>('read_file', {
  path: 'C:\\temp\\test.txt'
});
console.log(result);

// With complex types
interface Task {
  id: string;
  title: string;
}

const tasks = await invoke<Task[]>('get_all_tasks');
tasks.forEach(task => console.log(task.title));
```

**Error Handling:**
```typescript
// Try-catch pattern
try {
  const user = await invoke<User>('get_user', { id: 42 });
  console.log('User loaded:', user.username);
} catch (error) {
  console.error('Command failed:', error);
  // error is the String returned from Rust's Err()
}

// Promise pattern
invoke<User>('get_user', { id: 42 })
  .then(user => {
    console.log('Success:', user);
  })
  .catch(error => {
    console.error('Failed:', error);
  });
```

**Type Safety:**
```typescript
interface CreateTaskParams {
  title: string;
  description: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

// Type-safe invoke
async function createTask(params: CreateTaskParams): Promise<Task> {
  return await invoke<Task>('create_task', params);
}

// Usage with autocomplete
const task = await createTask({
  title: 'Learn TypeScript',    // ✅ IDE suggests these properties
  description: 'Master types',  // ✅ Type checking at compile time
});

console.log(task.id);            // ✅ IDE knows task has 'id'
console.log(task.invalid);       // ❌ Error: Property 'invalid' doesn't exist
```

### QuickConnect invoke() Examples

```typescript
// Get all hosts
interface Host {
  hostname: string;
  description: string;
  username: string;
  domain: string;
  created: string;
  modified: string;
  credential_target: string | null;
}

const hosts = await invoke<Host[]>('get_hosts');

// Add new host
await invoke('add_host', {
  hostname: 'server01.domain.com',
  description: 'Production Server',
  username: 'admin',
  domain: 'DOMAIN'
});

// Connect to RDP
await invoke('connect_rdp', { hostname: 'server01.domain.com' });

// Scan Active Directory
interface ADHost {
  name: string;
  dns_hostname: string;
  operating_system: string;
}

const adHosts = await invoke<ADHost[]>('scan_domain', {
  server: 'dc01.domain.com',
  username: 'admin',
  password: 'secret',
  searchBase: 'DC=domain,DC=com'
});
```

---

## 5.5 Events - Push Notifications from Backend

### Event Pattern

Events allow Rust to push data to the frontend without being asked:

**Rust (Backend):**
```rust
use tauri::Manager;

#[tauri::command]
async fn long_running_task(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Emit progress updates
    app_handle.emit("progress", ProgressPayload {
        percent: 25,
        message: "Processing...".to_string(),
    }).ok();
    
    // Do work...
    std::thread::sleep(std::time::Duration::from_secs(1));
    
    app_handle.emit("progress", ProgressPayload {
        percent: 50,
        message: "Halfway there...".to_string(),
    }).ok();
    
    // More work...
    std::thread::sleep(std::time::Duration::from_secs(1));
    
    app_handle.emit("progress", ProgressPayload {
        percent: 100,
        message: "Complete!".to_string(),
    }).ok();
    
    Ok(())
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    percent: u32,
    message: String,
}
```

**TypeScript (Frontend):**
```typescript
import { listen } from '@tauri-apps/api/event';

interface ProgressPayload {
  percent: number;
  message: string;
}

// Listen for progress events
const unlisten = await listen<ProgressPayload>('progress', (event) => {
  console.log(`Progress: ${event.payload.percent}% - ${event.payload.message}`);
  
  // Update UI
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.width = `${event.payload.percent}%`;
    progressBar.textContent = event.payload.message;
  }
});

// Start the task
await invoke('long_running_task');

// Clean up listener when done
unlisten();
```

### Event Lifecycle

```typescript
// 1. Register listener (returns unlisten function)
const unlisten = await listen<DataType>('event-name', (event) => {
  // Handle event
  console.log(event.payload);
});

// 2. Events are received automatically
// (Backend emits them)

// 3. Clean up when no longer needed
unlisten();

// Common pattern: useEffect in React or component lifecycle
document.addEventListener('DOMContentLoaded', async () => {
  const unlisten = await listen('my-event', handleEvent);
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    unlisten();
  });
});
```

### Multiple Listeners

```typescript
// Different components can listen to the same event
const unlisten1 = await listen('data-updated', (event) => {
  updateTable(event.payload);
});

const unlisten2 = await listen('data-updated', (event) => {
  updateChart(event.payload);
});

const unlisten3 = await listen('data-updated', (event) => {
  updateStats(event.payload);
});

// All three will be called when backend emits 'data-updated'
```

### QuickConnect Event Examples

```typescript
// Listen for connection status updates
interface ConnectionStatus {
  hostname: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  message: string;
}

await listen<ConnectionStatus>('rdp-status', (event) => {
  const { hostname, status, message } = event.payload;
  
  if (status === 'error') {
    showErrorNotification(`Failed to connect to ${hostname}: ${message}`);
  } else if (status === 'connected') {
    showSuccessNotification(`Connected to ${hostname}`);
  }
});

// Listen for domain scan progress
interface ScanProgress {
  found: number;
  total: number;
  current: string;
}

await listen<ScanProgress>('scan-progress', (event) => {
  const { found, total, current } = event.payload;
  updateProgressBar((found / total) * 100);
  updateStatusText(`Scanning: ${current} (${found}/${total})`);
});
```

---

## 5.6 Async/Await Patterns

### Understanding Promises in Tauri

All Tauri `invoke()` calls return Promises:

```typescript
// invoke() returns Promise<T>
const promise: Promise<string> = invoke<string>('get_message');

// await unwraps the Promise
const message: string = await invoke<string>('get_message');
```

### Sequential Operations

```typescript
// Operations happen one after another
async function loadUserData(userId: number) {
  console.log('Loading user...');
  const user = await invoke<User>('get_user', { userId });
  
  console.log('Loading user posts...');
  const posts = await invoke<Post[]>('get_posts', { userId });
  
  console.log('Loading user comments...');
  const comments = await invoke<Comment[]>('get_comments', { userId });
  
  return { user, posts, comments };
}

// Total time: time1 + time2 + time3
```

### Parallel Operations

```typescript
// Operations happen simultaneously
async function loadUserDataParallel(userId: number) {
  console.log('Loading all data...');
  
  // Start all three requests at once
  const [user, posts, comments] = await Promise.all([
    invoke<User>('get_user', { userId }),
    invoke<Post[]>('get_posts', { userId }),
    invoke<Comment[]>('get_comments', { userId })
  ]);
  
  return { user, posts, comments };
}

// Total time: max(time1, time2, time3)
// Much faster for independent operations!
```

### Error Handling Patterns

**Try-Catch:**
```typescript
async function loadData() {
  try {
    const data = await invoke<Data>('get_data');
    processData(data);
  } catch (error) {
    console.error('Failed to load data:', error);
    showErrorMessage(String(error));
  }
}
```

**Optional Chaining:**
```typescript
async function getUser(id: number): Promise<User | null> {
  try {
    return await invoke<User>('get_user', { id });
  } catch (error) {
    console.error('User not found:', error);
    return null;
  }
}

// Usage
const user = await getUser(42);
if (user) {
  console.log(user.username);
} else {
  console.log('User not found');
}
```

**Promise.allSettled (handle some failures):**
```typescript
async function loadMultipleHosts(hostnames: string[]) {
  const results = await Promise.allSettled(
    hostnames.map(hostname => 
      invoke<HostStatus>('check_host', { hostname })
    )
  );
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`${hostnames[index]}: OK`, result.value);
    } else {
      console.error(`${hostnames[index]}: FAILED`, result.reason);
    }
  });
}
```

### QuickConnect Async Patterns

```typescript
// Load hosts on startup
async function initializeApp() {
  try {
    // Load hosts and theme in parallel
    const [hosts, theme] = await Promise.all([
      invoke<Host[]>('get_hosts'),
      invoke<string>('get_theme')
    ]);
    
    renderHosts(hosts);
    applyTheme(theme);
  } catch (error) {
    showErrorWindow('Failed to initialize application');
  }
}

// Connect to RDP with loading state
async function connectToHost(hostname: string) {
  const button = document.querySelector(`[data-host="${hostname}"]`);
  button?.classList.add('loading');
  
  try {
    await invoke('connect_rdp', { hostname });
    showNotification(`Connected to ${hostname}`, 'success');
  } catch (error) {
    showNotification(`Failed to connect: ${error}`, 'error');
  } finally {
    button?.classList.remove('loading');
  }
}

// Scan domain with progress updates
async function scanDomain(server: string, credentials: Credentials) {
  let progressUnlisten: (() => void) | null = null;
  
  try {
    // Set up progress listener
    progressUnlisten = await listen<ScanProgress>('scan-progress', (event) => {
      updateProgressBar(event.payload);
    });
    
    // Start scan
    const hosts = await invoke<ADHost[]>('scan_domain', {
      server,
      ...credentials
    });
    
    showNotification(`Found ${hosts.length} hosts`, 'success');
    return hosts;
  } catch (error) {
    showNotification(`Scan failed: ${error}`, 'error');
    return [];
  } finally {
    // Clean up listener
    progressUnlisten?.();
  }
}
```

---

## 5.7 Frontend State Management

### Local State (Single Component)

```typescript
// Simple variables for component-specific state
let tasks: Task[] = [];
let currentFilter: FilterType = 'all';
let searchQuery: string = '';

function renderTasks() {
  const filtered = tasks
    .filter(task => {
      // Apply filter
      if (currentFilter === 'active') return !task.completed;
      if (currentFilter === 'completed') return task.completed;
      return true;
    })
    .filter(task => {
      // Apply search
      if (!searchQuery) return true;
      return task.title.toLowerCase().includes(searchQuery.toLowerCase());
    });
  
  // Render filtered tasks
  displayTasks(filtered);
}
```

### Global State (Multiple Components)

```typescript
// state.ts
export class AppState {
  private static instance: AppState;
  
  private _hosts: Host[] = [];
  private _selectedHost: Host | null = null;
  private _theme: 'light' | 'dark' = 'dark';
  
  private listeners: Map<string, Set<() => void>> = new Map();
  
  private constructor() {}
  
  static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState();
    }
    return AppState.instance;
  }
  
  // Getters
  get hosts(): Host[] {
    return [...this._hosts];
  }
  
  get selectedHost(): Host | null {
    return this._selectedHost;
  }
  
  get theme(): string {
    return this._theme;
  }
  
  // Setters with notifications
  setHosts(hosts: Host[]) {
    this._hosts = hosts;
    this.notify('hosts');
  }
  
  selectHost(host: Host | null) {
    this._selectedHost = host;
    this.notify('selectedHost');
  }
  
  setTheme(theme: 'light' | 'dark') {
    this._theme = theme;
    this.notify('theme');
    document.documentElement.setAttribute('data-theme', theme);
  }
  
  // Subscribe to changes
  subscribe(key: string, callback: () => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }
  
  private notify(key: string) {
    this.listeners.get(key)?.forEach(callback => callback());
  }
}

// Usage
const state = AppState.getInstance();

// Subscribe to changes
const unsubscribe = state.subscribe('hosts', () => {
  console.log('Hosts updated:', state.hosts);
  renderHostList();
});

// Update state
state.setHosts(await invoke<Host[]>('get_hosts'));

// Clean up
unsubscribe();
```

### LocalStorage for Persistence

```typescript
// Save state to localStorage
function saveState<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Load state from localStorage
function loadState<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored) as T;
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

// Usage
saveState('theme', 'dark');
saveState('filter', 'active');
saveState('lastHost', { hostname: 'server01', timestamp: Date.now() });

const theme = loadState('theme', 'light');
const filter = loadState<FilterType>('filter', 'all');
```

### QuickConnect State Management

```typescript
// QuickConnect uses a simple global state pattern
let hosts: Host[] = [];
let currentTheme: string = 'dark';
let debugMode: boolean = false;

// Load state on startup
async function initializeState() {
  // Load from backend
  hosts = await invoke<Host[]>('get_hosts');
  
  // Load from localStorage
  currentTheme = loadState('theme', 'dark');
  debugMode = loadState('debugMode', false);
  
  // Apply theme
  document.documentElement.setAttribute('data-theme', currentTheme);
}

// Update and persist
async function setTheme(theme: string) {
  currentTheme = theme;
  saveState('theme', theme);
  await invoke('set_theme', { theme });
  document.documentElement.setAttribute('data-theme', theme);
}

// Refresh from backend
async function refreshHosts() {
  hosts = await invoke<Host[]>('get_hosts');
  renderHostList();
}
```

---

## 5.8 Form Handling and Validation

### Type-Safe Forms

```typescript
interface FormData {
  hostname: string;
  description: string;
  username: string;
  domain: string;
}

function getFormData(formId: string): FormData | null {
  const form = document.getElementById(formId) as HTMLFormElement;
  if (!form) return null;
  
  const formData = new FormData(form);
  
  return {
    hostname: formData.get('hostname') as string,
    description: formData.get('description') as string,
    username: formData.get('username') as string,
    domain: formData.get('domain') as string,
  };
}

// Usage
const form = document.getElementById('add-host-form') as HTMLFormElement;
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const data = getFormData('add-host-form');
  if (!data) return;
  
  try {
    await invoke('add_host', data);
    form.reset();
    showNotification('Host added successfully', 'success');
  } catch (error) {
    showNotification(String(error), 'error');
  }
});
```

### Client-Side Validation

```typescript
interface ValidationRule {
  field: string;
  validate: (value: string) => boolean;
  message: string;
}

const rules: ValidationRule[] = [
  {
    field: 'hostname',
    validate: (v) => v.trim().length > 0,
    message: 'Hostname is required'
  },
  {
    field: 'hostname',
    validate: (v) => /^[a-zA-Z0-9.-]+$/.test(v),
    message: 'Hostname contains invalid characters'
  },
  {
    field: 'username',
    validate: (v) => v.trim().length > 0,
    message: 'Username is required'
  },
];

function validateForm(data: Record<string, string>): string[] {
  const errors: string[] = [];
  
  for (const rule of rules) {
    if (!rule.validate(data[rule.field] || '')) {
      errors.push(rule.message);
    }
  }
  
  return errors;
}

// Usage
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const data = getFormData('add-host-form');
  if (!data) return;
  
  const errors = validateForm(data);
  if (errors.length > 0) {
    showErrors(errors);
    return;
  }
  
  try {
    await invoke('add_host', data);
  } catch (error) {
    showNotification(String(error), 'error');
  }
});
```

### Real-Time Validation

```typescript
// Validate on input
const hostnameInput = document.getElementById('hostname') as HTMLInputElement;

hostnameInput.addEventListener('input', (e) => {
  const value = (e.target as HTMLInputElement).value;
  const errorElement = document.getElementById('hostname-error');
  
  if (!errorElement) return;
  
  if (value.trim().length === 0) {
    errorElement.textContent = 'Hostname is required';
    errorElement.classList.remove('hidden');
  } else if (!/^[a-zA-Z0-9.-]+$/.test(value)) {
    errorElement.textContent = 'Invalid hostname format';
    errorElement.classList.remove('hidden');
  } else {
    errorElement.textContent = '';
    errorElement.classList.add('hidden');
  }
});
```

---

## 5.9 QuickConnect Frontend Architecture Analysis

### File Structure

```
src/
├── main.ts          # Login window logic
├── hosts.ts         # Hosts management window
├── about.ts         # About window
├── error.ts         # Error window
└── styles.css       # Global styles
```

### main.ts - Login Window

```typescript
import { invoke } from "@tauri-apps/api/core";

interface LoginCredentials {
  username: string;
  password: string;
  domain: string;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const username = (document.getElementById("username") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const domain = (document.getElementById("domain") as HTMLInputElement).value;
    
    try {
      // Verify credentials
      const valid = await invoke<boolean>("verify_login", {
        username,
        password,
        domain
      });
      
      if (valid) {
        // Save credentials
        await invoke("save_credentials", { username, password, domain });
        
        // Open main window
        await invoke("open_main_window");
      } else {
        showError("Invalid credentials");
      }
    } catch (error) {
      showError(String(error));
    }
  });
});
```

### hosts.ts - Hosts Management

```typescript
interface Host {
  hostname: string;
  description: string;
  username: string;
  domain: string;
  created: string;
  modified: string;
  credential_target: string | null;
}

let hosts: Host[] = [];
let filteredHosts: Host[] = [];

async function loadHosts() {
  try {
    hosts = await invoke<Host[]>("get_hosts");
    filteredHosts = [...hosts];
    renderHosts();
  } catch (error) {
    console.error("Failed to load hosts:", error);
  }
}

function renderHosts() {
  const container = document.getElementById("hosts-container");
  if (!container) return;
  
  container.innerHTML = filteredHosts.map(host => `
    <div class="card bg-base-200 shadow-sm">
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(host.hostname)}</h3>
        <p>${escapeHtml(host.description)}</p>
        <div class="card-actions">
          <button onclick="connectToHost('${host.hostname}')" class="btn btn-primary">
            Connect
          </button>
          <button onclick="editHost('${host.hostname}')" class="btn btn-ghost">
            Edit
          </button>
          <button onclick="deleteHost('${host.hostname}')" class="btn btn-error">
            Delete
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Search and filter
const searchInput = document.getElementById("search");
searchInput?.addEventListener("input", (e) => {
  const query = (e.target as HTMLInputElement).value.toLowerCase();
  
  filteredHosts = hosts.filter(host => 
    host.hostname.toLowerCase().includes(query) ||
    host.description.toLowerCase().includes(query) ||
    host.username.toLowerCase().includes(query)
  );
  
  renderHosts();
});

// Global functions for onclick handlers
window.connectToHost = async function(hostname: string) {
  try {
    await invoke("connect_rdp", { hostname });
  } catch (error) {
    await invoke("show_error_window", { 
      message: `Failed to connect to ${hostname}: ${error}` 
    });
  }
};

window.editHost = async function(hostname: string) {
  const host = hosts.find(h => h.hostname === hostname);
  if (!host) return;
  
  // Show edit modal and populate with host data
  showEditModal(host);
};

window.deleteHost = async function(hostname: string) {
  const confirmed = confirm(`Delete host ${hostname}?`);
  if (!confirmed) return;
  
  try {
    await invoke("delete_host", { hostname });
    await loadHosts();
  } catch (error) {
    await invoke("show_error_window", { message: String(error) });
  }
};
```

### Key Patterns Used

**1. Global Window Functions**
```typescript
// TypeScript declarations
declare global {
  interface Window {
    connectToHost: (hostname: string) => Promise<void>;
    editHost: (hostname: string) => Promise<void>;
    deleteHost: (hostname: string) => Promise<void>;
  }
}

// Allows onclick handlers in HTML
<button onclick="connectToHost('server01')">Connect</button>
```

**2. Defensive Null Checks**
```typescript
const element = document.getElementById("my-element");
if (!element) return;  // Guard clause

// Or optional chaining
element?.addEventListener("click", handler);
```

**3. HTML Escaping for Security**
```typescript
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Prevents XSS attacks
container.innerHTML = `<p>${escapeHtml(userInput)}</p>`;
```

**4. Error Forwarding to Error Window**
```typescript
try {
  await invoke("risky_operation");
} catch (error) {
  await invoke("show_error_window", { 
    message: String(error) 
  });
}
```

---

## 5.10 Best Practices

### Type Everything

```typescript
// ❌ Bad - implicit any
function handleData(data) {
  return data.value;
}

// ✅ Good - explicit types
function handleData(data: { value: string }): string {
  return data.value;
}
```

### Use Interfaces for Objects

```typescript
// ❌ Bad - inline type
function createUser(user: { name: string; email: string }) {
  // ...
}

// ✅ Good - interface
interface User {
  name: string;
  email: string;
}

function createUser(user: User) {
  // ...
}
```

### Async/Await Over Promises

```typescript
// ❌ Harder to read
invoke('get_data')
  .then(data => processData(data))
  .then(result => saveResult(result))
  .catch(error => handleError(error));

// ✅ Cleaner
async function loadAndProcess() {
  try {
    const data = await invoke('get_data');
    const result = await processData(data);
    await saveResult(result);
  } catch (error) {
    handleError(error);
  }
}
```

### Null Safety

```typescript
// ❌ Unsafe
function getElement(id: string) {
  return document.getElementById(id);
}

const element = getElement("my-id");
element.addEventListener("click", handler); // Might be null!

// ✅ Safe
function getElement(id: string): HTMLElement | null {
  return document.getElementById(id);
}

const element = getElement("my-id");
if (element) {
  element.addEventListener("click", handler);
}

// Or with optional chaining
getElement("my-id")?.addEventListener("click", handler);
```

### Type Guards

```typescript
interface SuccessResponse {
  type: 'success';
  data: string;
}

interface ErrorResponse {
  type: 'error';
  message: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

function isSuccess(response: ApiResponse): response is SuccessResponse {
  return response.type === 'success';
}

function handleResponse(response: ApiResponse) {
  if (isSuccess(response)) {
    console.log(response.data);    // TypeScript knows it's SuccessResponse
  } else {
    console.error(response.message); // TypeScript knows it's ErrorResponse
  }
}
```

---

## 5.11 Practice Exercises

### Exercise 1: Type-Safe Settings Manager

Create a settings management system with TypeScript types:

```typescript
// TODO: Define types
interface AppSettings {
  theme: 'light' | 'dark';
  language: 'en' | 'es' | 'fr';
  notifications: boolean;
  autoSave: boolean;
}

// TODO: Implement functions
async function loadSettings(): Promise<AppSettings> {
  // Load from backend or localStorage
}

async function saveSettings(settings: AppSettings): Promise<void> {
  // Save to backend and localStorage
}

function validateSettings(settings: unknown): settings is AppSettings {
  // Type guard to validate settings object
}
```

### Exercise 2: Event-Driven Progress Tracker

Build a system that tracks long-running operations:

```typescript
// TODO: Define types
interface ProgressEvent {
  operation: string;
  percent: number;
  message: string;
  timestamp: string;
}

// TODO: Implement
class ProgressTracker {
  async startOperation(operationId: string) {
    // Listen for progress events
    // Update UI with progress
    // Handle completion
  }
  
  updateProgress(event: ProgressEvent) {
    // Update progress bar
    // Show message
  }
}
```

### Exercise 3: Form Builder with Validation

Create a type-safe form system:

```typescript
// TODO: Define types
interface FieldDefinition {
  name: string;
  type: 'text' | 'email' | 'number' | 'select';
  label: string;
  required: boolean;
  validation?: (value: string) => boolean;
  errorMessage?: string;
}

// TODO: Implement
class FormBuilder {
  constructor(fields: FieldDefinition[]) {
    // Build form HTML
  }
  
  validate(): boolean {
    // Validate all fields
  }
  
  getData<T>(): T {
    // Get typed form data
  }
}
```

### Exercise 4: Async Queue Manager

Handle multiple async operations with a queue:

```typescript
// TODO: Implement
class AsyncQueue<T> {
  private queue: Array<() => Promise<T>> = [];
  private running: boolean = false;
  
  async add(operation: () => Promise<T>): Promise<T> {
    // Add to queue and process
  }
  
  private async process() {
    // Process queue one at a time
  }
}

// Usage
const queue = new AsyncQueue<void>();
queue.add(() => invoke('operation1'));
queue.add(() => invoke('operation2'));
queue.add(() => invoke('operation3'));
```

### Exercise 5: State Observer Pattern

Implement a reactive state system:

```typescript
// TODO: Implement
class Observable<T> {
  private value: T;
  private listeners: Set<(value: T) => void> = new Set();
  
  constructor(initialValue: T) {
    this.value = initialValue;
  }
  
  get(): T {
    return this.value;
  }
  
  set(newValue: T): void {
    // Update value and notify listeners
  }
  
  subscribe(callback: (value: T) => void): () => void {
    // Add listener and return unsubscribe function
  }
}

// Usage
const count = new Observable(0);
count.subscribe(value => console.log('Count:', value));
count.set(5); // Logs: "Count: 5"
```

---

## Solutions

<details>
<summary>Click to reveal solutions</summary>

### Solution 1: Type-Safe Settings Manager

```typescript
interface AppSettings {
  theme: 'light' | 'dark';
  language: 'en' | 'es' | 'fr';
  notifications: boolean;
  autoSave: boolean;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'en',
  notifications: true,
  autoSave: true,
};

async function loadSettings(): Promise<AppSettings> {
  // Try to load from localStorage first
  const stored = localStorage.getItem('settings');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (validateSettings(parsed)) {
        return parsed;
      }
    } catch {
      // Invalid JSON, fall through
    }
  }
  
  // Try to load from backend
  try {
    const settings = await invoke<AppSettings>('get_settings');
    if (validateSettings(settings)) {
      // Save to localStorage for faster access next time
      localStorage.setItem('settings', JSON.stringify(settings));
      return settings;
    }
  } catch {
    // Backend failed, use defaults
  }
  
  return defaultSettings;
}

async function saveSettings(settings: AppSettings): Promise<void> {
  if (!validateSettings(settings)) {
    throw new Error('Invalid settings object');
  }
  
  // Save to localStorage
  localStorage.setItem('settings', JSON.stringify(settings));
  
  // Save to backend
  await invoke('save_settings', { settings });
}

function validateSettings(settings: unknown): settings is AppSettings {
  if (typeof settings !== 'object' || settings === null) {
    return false;
  }
  
  const s = settings as Record<string, unknown>;
  
  return (
    (s.theme === 'light' || s.theme === 'dark') &&
    (s.language === 'en' || s.language === 'es' || s.language === 'fr') &&
    typeof s.notifications === 'boolean' &&
    typeof s.autoSave === 'boolean'
  );
}

// Usage
const settings = await loadSettings();
console.log('Current theme:', settings.theme);

settings.theme = 'light';
await saveSettings(settings);
```

### Solution 2: Event-Driven Progress Tracker

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

interface ProgressEvent {
  operation: string;
  percent: number;
  message: string;
  timestamp: string;
}

class ProgressTracker {
  private unlisten: UnlistenFn | null = null;
  private progressBar: HTMLElement | null = null;
  private statusText: HTMLElement | null = null;
  
  constructor(
    progressBarId: string,
    statusTextId: string
  ) {
    this.progressBar = document.getElementById(progressBarId);
    this.statusText = document.getElementById(statusTextId);
  }
  
  async startOperation(
    operationId: string,
    command: string,
    params: Record<string, unknown>
  ): Promise<void> {
    // Set up progress listener
    this.unlisten = await listen<ProgressEvent>('progress', (event) => {
      if (event.payload.operation === operationId) {
        this.updateProgress(event.payload);
      }
    });
    
    try {
      // Start the operation
      await invoke(command, params);
      
      // Show completion
      this.updateProgress({
        operation: operationId,
        percent: 100,
        message: 'Complete!',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.showError(String(error));
    } finally {
      // Clean up listener
      await this.cleanup();
    }
  }
  
  private updateProgress(event: ProgressEvent) {
    if (this.progressBar) {
      this.progressBar.style.width = `${event.percent}%`;
      this.progressBar.textContent = `${event.percent}%`;
    }
    
    if (this.statusText) {
      this.statusText.textContent = event.message;
    }
    
    console.log(`[${event.timestamp}] ${event.operation}: ${event.percent}% - ${event.message}`);
  }
  
  private showError(message: string) {
    if (this.statusText) {
      this.statusText.textContent = `Error: ${message}`;
      this.statusText.classList.add('text-error');
    }
  }
  
  async cleanup() {
    if (this.unlisten) {
      this.unlisten();
      this.unlisten = null;
    }
  }
}

// Usage
const tracker = new ProgressTracker('progress-bar', 'status-text');

await tracker.startOperation(
  'domain-scan',
  'scan_domain',
  {
    server: 'dc01.domain.com',
    username: 'admin',
    password: 'secret',
  }
);
```

### Solution 3: Form Builder with Validation

```typescript
interface FieldDefinition {
  name: string;
  type: 'text' | 'email' | 'number' | 'select';
  label: string;
  required: boolean;
  options?: string[];
  validation?: (value: string) => boolean;
  errorMessage?: string;
}

class FormBuilder {
  private fields: FieldDefinition[];
  private form: HTMLFormElement | null = null;
  private errors: Map<string, string> = new Map();
  
  constructor(fields: FieldDefinition[], formId: string) {
    this.fields = fields;
    this.form = document.getElementById(formId) as HTMLFormElement;
    
    if (this.form) {
      this.buildForm();
      this.setupValidation();
    }
  }
  
  private buildForm() {
    if (!this.form) return;
    
    this.form.innerHTML = this.fields.map(field => {
      const fieldHtml = this.renderField(field);
      return `
        <div class="form-control">
          <label class="label">
            <span class="label-text">
              ${field.label}
              ${field.required ? '<span class="text-error">*</span>' : ''}
            </span>
          </label>
          ${fieldHtml}
          <label class="label">
            <span class="label-text-alt text-error" id="${field.name}-error"></span>
          </label>
        </div>
      `;
    }).join('') + `
      <div class="form-control mt-6">
        <button type="submit" class="btn btn-primary">Submit</button>
      </div>
    `;
  }
  
  private renderField(field: FieldDefinition): string {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
        return `
          <input
            type="${field.type}"
            name="${field.name}"
            id="${field.name}"
            class="input input-bordered"
            ${field.required ? 'required' : ''}
          />
        `;
      case 'select':
        return `
          <select
            name="${field.name}"
            id="${field.name}"
            class="select select-bordered"
            ${field.required ? 'required' : ''}
          >
            <option value="">Select...</option>
            ${field.options?.map(opt => `<option value="${opt}">${opt}</option>`).join('') || ''}
          </select>
        `;
      default:
        return '';
    }
  }
  
  private setupValidation() {
    this.fields.forEach(field => {
      const input = document.getElementById(field.name) as HTMLInputElement;
      if (!input) return;
      
      input.addEventListener('blur', () => {
        this.validateField(field, input.value);
      });
    });
  }
  
  private validateField(field: FieldDefinition, value: string): boolean {
    const errorElement = document.getElementById(`${field.name}-error`);
    
    // Check required
    if (field.required && value.trim().length === 0) {
      this.errors.set(field.name, `${field.label} is required`);
      if (errorElement) {
        errorElement.textContent = this.errors.get(field.name)!;
      }
      return false;
    }
    
    // Check custom validation
    if (field.validation && !field.validation(value)) {
      this.errors.set(field.name, field.errorMessage || `Invalid ${field.label}`);
      if (errorElement) {
        errorElement.textContent = this.errors.get(field.name)!;
      }
      return false;
    }
    
    // Clear error
    this.errors.delete(field.name);
    if (errorElement) {
      errorElement.textContent = '';
    }
    return true;
  }
  
  validate(): boolean {
    this.errors.clear();
    
    let isValid = true;
    this.fields.forEach(field => {
      const input = document.getElementById(field.name) as HTMLInputElement;
      if (input && !this.validateField(field, input.value)) {
        isValid = false;
      }
    });
    
    return isValid;
  }
  
  getData<T>(): T {
    if (!this.form) throw new Error('Form not initialized');
    
    const formData = new FormData(this.form);
    const data: Record<string, string> = {};
    
    this.fields.forEach(field => {
      data[field.name] = formData.get(field.name) as string;
    });
    
    return data as T;
  }
}

// Usage
const formBuilder = new FormBuilder([
  {
    name: 'hostname',
    type: 'text',
    label: 'Hostname',
    required: true,
    validation: (v) => /^[a-zA-Z0-9.-]+$/.test(v),
    errorMessage: 'Hostname contains invalid characters',
  },
  {
    name: 'description',
    type: 'text',
    label: 'Description',
    required: false,
  },
  {
    name: 'port',
    type: 'number',
    label: 'Port',
    required: true,
    validation: (v) => {
      const num = parseInt(v);
      return num >= 1 && num <= 65535;
    },
    errorMessage: 'Port must be between 1 and 65535',
  },
], 'my-form');

const form = document.getElementById('my-form') as HTMLFormElement;
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (formBuilder.validate()) {
    const data = formBuilder.getData<{
      hostname: string;
      description: string;
      port: string;
    }>();
    
    console.log('Form data:', data);
    await invoke('submit_form', data);
  }
});
```

### Solution 4: Async Queue Manager

```typescript
class AsyncQueue<T> {
  private queue: Array<() => Promise<T>> = [];
  private running: boolean = false;
  private maxConcurrent: number;
  private activeCount: number = 0;
  
  constructor(maxConcurrent: number = 1) {
    this.maxConcurrent = maxConcurrent;
  }
  
  async add(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      });
      
      this.process();
    });
  }
  
  private async process() {
    if (this.activeCount >= this.maxConcurrent) {
      return;
    }
    
    const operation = this.queue.shift();
    if (!operation) {
      return;
    }
    
    this.activeCount++;
    
    try {
      await operation();
    } catch (error) {
      console.error('Queue operation failed:', error);
    } finally {
      this.activeCount--;
      this.process(); // Process next item
    }
  }
  
  get pending(): number {
    return this.queue.length + this.activeCount;
  }
}

// Usage - Sequential (1 at a time)
const sequentialQueue = new AsyncQueue<void>(1);

sequentialQueue.add(() => invoke('operation1'));
sequentialQueue.add(() => invoke('operation2'));
sequentialQueue.add(() => invoke('operation3'));
// Executes: op1 → wait → op2 → wait → op3

// Usage - Concurrent (3 at a time)
const concurrentQueue = new AsyncQueue<void>(3);

for (let i = 0; i < 10; i++) {
  concurrentQueue.add(() => invoke('process_item', { id: i }));
}
// Executes: first 3 in parallel, then next 3, etc.
```

### Solution 5: State Observer Pattern

```typescript
class Observable<T> {
  private value: T;
  private listeners: Set<(value: T) => void> = new Set();
  
  constructor(initialValue: T) {
    this.value = initialValue;
  }
  
  get(): T {
    return this.value;
  }
  
  set(newValue: T): void {
    if (this.value === newValue) {
      return; // No change
    }
    
    this.value = newValue;
    this.notify();
  }
  
  update(updater: (current: T) => T): void {
    this.set(updater(this.value));
  }
  
  subscribe(callback: (value: T) => void): () => void {
    this.listeners.add(callback);
    
    // Call immediately with current value
    callback(this.value);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  private notify(): void {
    this.listeners.forEach(callback => callback(this.value));
  }
}

// Usage
const count = new Observable(0);

// Subscribe to changes
const unsubscribe1 = count.subscribe(value => {
  console.log('Count changed:', value);
  document.getElementById('count')!.textContent = value.toString();
});

const unsubscribe2 = count.subscribe(value => {
  if (value > 10) {
    console.log('Count is high!');
  }
});

// Update value
count.set(5);     // Both subscribers notified
count.set(15);    // Both subscribers notified, second one logs warning

// Update with function
count.update(current => current + 1); // Increment

// Clean up
unsubscribe1();
unsubscribe2();

// Complex example with objects
interface User {
  name: string;
  age: number;
}

const currentUser = new Observable<User | null>(null);

currentUser.subscribe(user => {
  if (user) {
    document.getElementById('username')!.textContent = user.name;
  } else {
    document.getElementById('username')!.textContent = 'Not logged in';
  }
});

// Login
currentUser.set({ name: 'Alice', age: 30 });

// Logout
currentUser.set(null);
```

</details>

---

## 5.12 Key Takeaways

✅ **TypeScript provides essential type safety**
- Catch errors at compile time
- Self-documenting code
- Refactoring confidence
- Better IDE support

✅ **Types must match across IPC bridge**
- Frontend TypeScript ↔ Backend Rust
- Serde serialization handles conversion
- Document type mappings

✅ **Tauri API is fully typed**
- `invoke<T>()` for type-safe commands
- `listen<T>()` for type-safe events
- All returns are Promises

✅ **Async/await is the standard**
- All Tauri operations are async
- Use `try-catch` for error handling
- Parallelize independent operations with `Promise.all()`

✅ **State management patterns**
- Local state for components
- Global state for shared data
- LocalStorage for persistence
- Observable pattern for reactivity

---

## Next Steps

In **Chapter 6: Styling with Tailwind CSS and DaisyUI**, we'll explore:
- Installing and configuring Tailwind CSS
- Using the DaisyUI component library
- Creating responsive layouts
- Implementing dark/light themes
- Building beautiful, accessible UIs
- Analyzing QuickConnect's styling approach

**You now have a solid foundation in TypeScript for Tauri!** 🎉

You understand how to write type-safe frontend code, work with the Tauri API, handle async operations, and structure your application professionally.

---

## Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Official TypeScript documentation
- [Tauri API Docs](https://tauri.app/v1/api/js/) - Complete Tauri JavaScript API
- [TypeScript Playground](https://www.typescriptlang.org/play) - Try TypeScript in browser
- [Type Challenges](https://github.com/type-challenges/type-challenges) - Practice TypeScript
- [You Don't Know JS](https://github.com/getify/You-Dont-Know-JS) - Deep JavaScript knowledge

