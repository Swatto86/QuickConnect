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

## 5.1.5 Frontend Fundamentals Primer

**⚠️ Skip this section if you already know:**
- HTML/DOM manipulation
- Async/await and Promises
- Event listeners
- Basic CSS selectors

**Read this section if you're new to frontend development!**

### 🌐 HTML and the DOM (Document Object Model)

Think of a web page as a tree of elements:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My App</title>
  </head>
  <body>
    <div id="app">
      <h1>Welcome</h1>
      <button id="myButton">Click Me</button>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    </div>
  </body>
</html>
```

**Visual Representation:**

```
📄 document
 └─ html
     ├─ head
     │   └─ title ("My App")
     └─ body
         └─ div (id="app")
             ├─ h1 ("Welcome")
             ├─ button (id="myButton")
             └─ ul
                 ├─ li ("Item 1")
                 └─ li ("Item 2")
```

**Key Concepts:**

1. **Elements** are the building blocks (div, button, input, etc.)
2. **Attributes** provide extra info (`id="myButton"`, `class="primary"`)
3. **Text Content** is what users see
4. **The DOM** is the live representation in memory that JavaScript can manipulate

### 🎯 Selecting Elements

JavaScript/TypeScript can find and manipulate any element:

```typescript
// Get element by ID (fastest, most common)
const button = document.getElementById('myButton');

// Get element by CSS selector (flexible)
const button = document.querySelector('#myButton');
const allButtons = document.querySelectorAll('button');

// Modern best practice for Tauri apps:
const button = document.getElementById('myButton') as HTMLButtonElement;
//                                                   ^^^ TypeScript type
```

**Common Selectors:**

```typescript
// By ID
document.getElementById('searchInput')
document.querySelector('#searchInput')  // Same thing

// By class
document.querySelector('.btn-primary')   // First match
document.querySelectorAll('.btn-primary') // All matches

// By tag name
document.querySelector('button')
document.querySelectorAll('div')

// Complex selectors
document.querySelector('div.container > button#submit')
document.querySelector('input[type="text"]')
```

### 🎭 Manipulating Elements

Once you have an element, you can change it:

```typescript
// Get element
const heading = document.getElementById('title') as HTMLHeadingElement;

// Change text content
heading.textContent = 'New Title';

// Change HTML content
heading.innerHTML = '<strong>Bold Title</strong>';

// Change attributes
heading.setAttribute('class', 'large-title');
heading.className = 'large-title'; // Same thing

// Change styles
heading.style.color = 'blue';
heading.style.fontSize = '24px';

// Show/hide elements
heading.style.display = 'none';  // Hide
heading.style.display = 'block'; // Show

// Add/remove classes (best practice)
heading.classList.add('active');
heading.classList.remove('hidden');
heading.classList.toggle('highlight');
```

**QuickConnect Example:**

```typescript
// Update the search result count
const resultCount = document.getElementById('resultCount');
if (resultCount) {
  resultCount.textContent = `Found ${hosts.length} servers`;
}

// Show loading spinner
const spinner = document.getElementById('loadingSpinner');
if (spinner) {
  spinner.classList.remove('hidden');
}
```

### ⏰ Async/Await: Real-Life Analogy

**The Restaurant Order:**

Imagine you're at a restaurant:

```
┌─────────────────────────────────────────────────┐
│         The Restaurant Analogy                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Synchronous (Blocking):                       │
│    You ───► Order food                         │
│        │                                        │
│        └──► ⏳ Wait here doing nothing          │
│                (stare at kitchen)               │
│        ┌──► Get food                           │
│        │                                        │
│        └──► Eat                                 │
│                                                 │
│  Asynchronous (Non-blocking):                  │
│    You ───► Order food                         │
│        │                                        │
│        └──► Go check phone 📱                   │
│             Read messages                       │
│             Play game                           │
│        ┌──► 🔔 "Your order is ready!"          │
│        │                                        │
│        └──► Get food and eat                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**In code:**

```typescript
// ❌ Synchronous (blocks everything)
function getDataBlocking() {
  // Imagine this takes 3 seconds
  const data = fetchFromDisk(); // App freezes here!
  console.log(data);
  return data;
}
// User can't click anything while this runs

// ✅ Asynchronous (doesn't block)
async function getDataAsync() {
  // This returns immediately, work happens in background
  const data = await fetchFromDisk(); // App stays responsive!
  console.log(data);
  return data;
}
// User can still interact with the app
```

### 🎁 Promises: The IOU Note

A **Promise** is like an IOU note from a function:

```
┌──────────────────────────────────────┐
│           Promise States             │
├──────────────────────────────────────┤
│                                      │
│  📋 Pending                          │
│     "I'm working on it..."           │
│     (Initial state)                  │
│              │                       │
│              ├─────────┬─────────┐   │
│              ▼         ▼         │   │
│  ✅ Fulfilled      ❌ Rejected   │   │
│     "Here's your    "Sorry, it   │   │
│      result!"        failed"     │   │
│                                      │
└──────────────────────────────────────┘
```

**Basic Promise Usage:**

```typescript
// Creating a promise
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Using promises: Old way (.then)
delay(1000).then(() => {
  console.log('1 second passed');
});

// Using promises: Modern way (async/await)
async function waitAndLog() {
  await delay(1000);
  console.log('1 second passed');
}
```

### 🌉 Async/Await in Tauri (The Bridge)

Every Tauri command returns a Promise because it involves IPC (talking to Rust):

```typescript
// Calling Rust from JavaScript is ALWAYS async
import { invoke } from '@tauri-apps/api/core';

// ❌ Wrong: Trying to use it synchronously
const hosts = invoke('get_hosts'); 
// hosts is a Promise, not the actual data!

// ✅ Correct: Wait for the promise
async function loadHosts() {
  const hosts = await invoke<Host[]>('get_hosts');
  // Now hosts is the actual data
  console.log(hosts);
}

// ✅ Also correct: Using .then
invoke<Host[]>('get_hosts').then(hosts => {
  console.log(hosts);
});
```

**Real-World Comparison:**

```typescript
// Think of invoke() like ordering from Amazon:

// 1. You place the order (invoke the command)
const orderPromise = invoke('get_user_data');

// 2. Amazon says "We'll get that to you" (Promise pending)
// Your life continues, you can do other things

// 3. Eventually, package arrives (Promise resolves)
const data = await orderPromise;
// Now you have your data!

// If something goes wrong (Promise rejects)
try {
  const data = await invoke('get_user_data');
} catch (error) {
  console.error('Order failed:', error);
}
```

### 🎪 Event Listeners: Reacting to User Actions

Event listeners let your code respond when things happen:

```typescript
// Get the button
const button = document.getElementById('submitBtn') as HTMLButtonElement;

// Add a click listener
button.addEventListener('click', () => {
  console.log('Button was clicked!');
});

// With async operations
button.addEventListener('click', async () => {
  const result = await invoke('save_data');
  console.log('Data saved:', result);
});
```

**Common Events:**

```typescript
// Click events
button.addEventListener('click', (event) => {
  console.log('Clicked!', event);
});

// Input events (every keystroke)
input.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement;
  console.log('Current value:', target.value);
});

// Form submission
form.addEventListener('submit', async (event) => {
  event.preventDefault(); // Stop page reload!
  const formData = new FormData(event.target as HTMLFormElement);
  await invoke('save_form', { data: Object.fromEntries(formData) });
});

// Keyboard events
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    console.log('Enter pressed!');
  }
});

// Window events
window.addEventListener('load', () => {
  console.log('Page fully loaded');
});
```

**QuickConnect Pattern:**

```typescript
// Search input with debouncing
let searchTimeout: number;
const searchInput = document.getElementById('searchInput') as HTMLInputElement;

searchInput.addEventListener('input', (event) => {
  const query = (event.target as HTMLInputElement).value;
  
  // Clear previous timeout
  clearTimeout(searchTimeout);
  
  // Wait 300ms after user stops typing
  searchTimeout = window.setTimeout(() => {
    filterHosts(query);
  }, 300);
});
```

### 🎨 CSS Basics for Tauri Apps

CSS (Cascading Style Sheets) makes things look good:

**Basic Structure:**

```css
/* selector { property: value; } */

#myButton {
  background-color: blue;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.btn-primary {
  background-color: #007bff;
}

button:hover {
  opacity: 0.8;
}
```

**Common Selectors:**

```css
/* By ID */
#searchInput { ... }

/* By class */
.container { ... }

/* By tag */
button { ... }

/* Descendants */
.container button { ... }

/* Direct children */
.container > button { ... }

/* Multiple classes */
.btn.btn-primary { ... }

/* Pseudo-classes */
button:hover { ... }
button:active { ... }
input:focus { ... }
```

**Tauri apps typically use:**
- **Tailwind CSS** (utility classes): `class="flex items-center gap-2"`
- **DaisyUI** (components): `class="btn btn-primary"`

**QuickConnect uses DaisyUI:**

```html
<!-- No need to write CSS! Just use classes -->
<button class="btn btn-primary">
  Click Me
</button>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Server Info</h2>
    <p>Some content here</p>
  </div>
</div>
```

### 🔍 Browser DevTools: Your Best Friend

**Opening DevTools:**
- **Windows/Linux**: `F12` or `Ctrl+Shift+I`
- **Mac**: `Cmd+Option+I`
- **Tauri**: Same shortcuts work!

**Console Tab:**

```typescript
// Logging messages
console.log('Normal message');
console.info('Info message');
console.warn('Warning message');
console.error('Error message');

// Inspect objects
console.log('User:', { name: 'Alice', age: 30 });

// Measure performance
console.time('operation');
// ... do something
console.timeEnd('operation'); // Prints: operation: 45.2ms
```

**Elements Tab:**
- Inspect HTML structure
- See CSS applied to elements
- Edit HTML/CSS live
- Find which styles are overriding others

**Network Tab:**
- Not really used in Tauri (no HTTP requests to backend)
- But useful for checking external API calls

**Console Errors:**

When something breaks, DevTools shows:
```
Uncaught TypeError: Cannot read property 'value' of null
    at main.ts:45
```

**This tells you:**
- **What went wrong**: Tried to access `.value` on null
- **Where**: Line 45 in main.ts
- **Why**: Element doesn't exist (wrong ID, not loaded yet, etc.)

### 🔧 Putting It All Together

**A Complete Example:**

```typescript
// 1. Wait for page to load
document.addEventListener('DOMContentLoaded', async () => {
  
  // 2. Get elements
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  const resultsDiv = document.getElementById('results') as HTMLDivElement;
  const loadingSpinner = document.getElementById('loading') as HTMLDivElement;
  
  // 3. Load initial data (async!)
  try {
    loadingSpinner.classList.remove('hidden');
    const hosts = await invoke<Host[]>('get_all_hosts');
    displayHosts(hosts);
  } catch (error) {
    console.error('Failed to load hosts:', error);
    resultsDiv.textContent = 'Error loading data';
  } finally {
    loadingSpinner.classList.add('hidden');
  }
  
  // 4. Add event listeners
  searchInput.addEventListener('input', (event) => {
    const query = (event.target as HTMLInputElement).value;
    filterAndDisplay(query);
  });
});

// Helper functions
function displayHosts(hosts: Host[]) {
  const resultsDiv = document.getElementById('results')!;
  resultsDiv.innerHTML = hosts
    .map(host => `
      <div class="card">
        <h3>${host.hostname}</h3>
        <p>${host.description}</p>
      </div>
    `)
    .join('');
}

function filterAndDisplay(query: string) {
  // Filter logic here
}
```

**Key Patterns:**

1. ✅ Wait for `DOMContentLoaded` before accessing elements
2. ✅ Use TypeScript type assertions (`as HTMLInputElement`)
3. ✅ Always `await` Tauri invoke calls
4. ✅ Handle errors with try/catch
5. ✅ Use `classList` instead of directly changing `style`
6. ✅ Use template literals for HTML generation

### 📚 Quick Reference Card

```typescript
// === DOM Selection ===
document.getElementById('id')
document.querySelector('.class')
document.querySelectorAll('button')

// === DOM Manipulation ===
element.textContent = 'text'
element.innerHTML = '<b>html</b>'
element.classList.add('class')
element.classList.remove('class')
element.classList.toggle('class')
element.style.display = 'none'

// === Events ===
element.addEventListener('click', () => {})
element.addEventListener('input', (e) => {})
document.addEventListener('DOMContentLoaded', () => {})

// === Async/Await ===
async function doWork() {
  const result = await someAsyncFunction();
  return result;
}

// === Tauri Invoke ===
import { invoke } from '@tauri-apps/api/core';
const data = await invoke<Type>('command_name', { param: value });

// === Error Handling ===
try {
  const result = await invoke('command');
} catch (error) {
  console.error('Failed:', error);
}
```

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

**Rust (backend):**
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
    pub last_connected: Option<String>,
}
```

**TypeScript:**
```typescript
export interface Host {
  hostname: string;
  description: string;
  last_connected?: string;  // Option<String> → string | undefined
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
  last_connected?: string | null;
}

const hosts = await invoke<Host[]>('get_hosts');

// Add/update a host
await invoke('save_host', {
  host: {
    hostname: 'server01.domain.com',
    description: 'Production Server'
  }
});

// Connect to RDP
await invoke('launch_rdp', {
  host: { hostname: 'server01.domain.com', description: 'Production Server' }
});

// Scan Active Directory
const scanResult = await invoke<string>('scan_domain', {
  domain: 'domain.com',
  server: 'dc01.domain.com'
});
console.log(scanResult);
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
// 1) Hosts refresh event: emitted after save/delete/scan
await listen('hosts-updated', async () => {
  const hosts = await invoke<Host[]>('get_hosts');
  renderHosts(hosts);
});

// 2) Connection event: emitted after a successful RDP launch
await listen<string>('host-connected', (event) => {
  const hostname = event.payload;
  showSuccessNotification(`Connected to ${hostname}`);
});

// 3) Theme change event: emitted after set_theme
await listen<string>('theme-changed', (event) => {
  const theme = event.payload; // "light" | "dark"
  applyTheme(theme);
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
    await invoke('show_error', {
      message: 'Failed to initialize application',
      category: 'ERROR',
      details: String(error)
    });
  }
}

// Connect to RDP with loading state
async function connectToHost(hostname: string) {
  const button = document.querySelector(`[data-host="${hostname}"]`);
  button?.classList.add('loading');
  
  try {
    await invoke('launch_rdp', { host: { hostname, description: '' } });
    showNotification(`Connected to ${hostname}`, 'success');
  } catch (error) {
    showNotification(`Failed to connect: ${error}`, 'error');
  } finally {
    button?.classList.remove('loading');
  }
}

// Scan domain (credentials are read from stored credentials on the backend)
async function scanDomain(domain: string, server: string) {
  try {
    const result = await invoke<string>('scan_domain', { domain, server });
    showNotification(result, 'success');
    return result;
  } catch (error) {
    showNotification(`Scan failed: ${error}`, 'error');
    return null;
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
}

function getFormData(formId: string): FormData | null {
  const form = document.getElementById(formId) as HTMLFormElement;
  if (!form) return null;
  
  const formData = new FormData(form);
  
  return {
    hostname: formData.get('hostname') as string,
    description: formData.get('description') as string,
  };
}

// Usage
const form = document.getElementById('add-host-form') as HTMLFormElement;
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const data = getFormData('add-host-form');
  if (!data) return;
  
  try {
    await invoke('save_host', {
      host: {
        hostname: data.hostname,
        description: data.description
      }
    });
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
    field: 'description',
    validate: (v) => v.length <= 500,
    message: 'Description must be 500 characters or fewer'
  }
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
    await invoke('save_host', {
      host: {
        hostname: data.hostname,
        description: data.description
      }
    });
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

interface StoredCredentials {
  username: string;
  password: string;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const username = (document.getElementById("username") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;
    
    try {
      // Save credentials to Windows Credential Manager via backend
      await invoke("save_credentials", {
        credentials: {
          username,
          password,
        },
      });

      // Switch to main window after successful save
      await invoke("switch_to_main_window");
    } catch (error) {
      showError(String(error));
    }
  });
});
```

### hosts.ts - Hosts Management

```typescript
import { invoke } from '@tauri-apps/api/core';

interface Host {
  hostname: string;
  description: string;
  last_connected?: string;
  status?: 'online' | 'offline' | 'unknown' | 'checking';
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
    (host.last_connected ?? '').toLowerCase().includes(query)
  );
  
  renderHosts();
});

// Global functions for onclick handlers
window.connectToHost = async function(hostname: string) {
  try {
    // QuickConnect launches RDP via the backend `launch_rdp` command.
    // The real app typically passes a full Host object; this minimal example
    // shows the shape of an invoke call.
    await invoke("launch_rdp", { host: { hostname, description: "" } });
  } catch (error) {
    await invoke("show_error", {
      message: `Failed to connect to ${hostname}: ${error}`,
      category: "RDP_LAUNCH",
      details: String(error),
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
  const confirmed = await showCustomDialog({
    title: 'Delete Host',
    message: `Delete host ${hostname}?`,
    type: 'warning',
    showCancel: true
  });
  
  if (!confirmed) return;
  
  try {
    await invoke("delete_host", { hostname });
    await loadHosts();
  } catch (error) {
    await invoke("show_error", {
      message: String(error),
      category: "CSV_OPERATIONS",
      details: String(error),
    });
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
  await invoke("show_error", {
    message: String(error),
    category: "ERROR",
    details: String(error),
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

## 5.12 Frontend Utility Modules

QuickConnect organizes reusable functionality into dedicated utility modules located in `src/utils/`. This modular architecture promotes code reuse, testability, and maintainability across all windows.

### Module Architecture

**Directory Structure:**
```
src/utils/
├── index.ts        # Central export hub
├── validation.ts   # Input validation and sanitization
├── ui.ts           # UI interactions and notifications
├── errors.ts       # Error categorization and styling
└── hosts.ts        # Host filtering and display logic
```

**Import Pattern:**
```typescript
// Individual imports
import { isValidFQDN, escapeHtml } from './utils/validation';
import { showNotification } from './utils/ui';

// Batch imports from index
import { isValidFQDN, showNotification, filterHosts } from './utils';
```

---

### 5.12.1 Validation Module (`validation.ts`)

**Purpose:** Input validation and XSS prevention

The validation module provides robust validation for user input, particularly for network identifiers and credentials. All validation functions are thoroughly tested with 101 unit tests plus property-based testing.

**Core Functions:**

**`isValidFQDN(hostname: string): boolean`**
Validates Fully Qualified Domain Names according to RFC standards:

```typescript
// Implementation highlights
export function isValidFQDN(hostname: string): boolean {
  // Reject empty or whitespace-only input
  if (!hostname || !hostname.trim()) return false;
  
  // Reject IP addresses (192.168.1.1)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  
  // Require at least one dot
  if (!hostname.includes('.')) return false;
  
  // Validate format: labels separated by dots
  const labels = hostname.toLowerCase().split('.');
  
  // Each label must:
  // - Be 1-63 characters
  // - Start/end with alphanumeric
  // - Contain only alphanumeric and hyphens
  const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  
  return labels.every(label => {
    if (label.length === 0 || label.length > 63) return false;
    return labelRegex.test(label);
  }) && labels[labels.length - 1].length >= 2; // TLD at least 2 chars
}

// Usage examples
isValidFQDN('server.company.com')      // ✅ true
isValidFQDN('db-01.internal.corp.net') // ✅ true
isValidFQDN('192.168.1.1')             // ❌ false - IP address
isValidFQDN('localhost')               // ❌ false - no domain
isValidFQDN('server-.company.com')     // ❌ false - trailing hyphen
isValidFQDN('server.c')                // ❌ false - TLD too short
```

**`isValidDomain(domain: string): boolean`**
Validates domain names (similar to FQDN but less strict):

```typescript
export function isValidDomain(domain: string): boolean {
  if (!domain || !domain.trim()) return false;
  
  // Allow single-label domains (e.g., "WORKGROUP")
  const labels = domain.toLowerCase().split('.');
  const labelRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  
  return labels.every(label => {
    if (label.length === 0 || label.length > 63) return false;
    return labelRegex.test(label);
  });
}

// Usage examples
isValidDomain('WORKGROUP')             // ✅ true - single label OK
isValidDomain('company.com')           // ✅ true
isValidDomain('192.168.1.1')          // ❌ false
```

**`isValidServerName(hostname: string, domain: string): boolean`**
Validates that a server belongs to a specific domain:

```typescript
export function isValidServerName(hostname: string, domain: string): boolean {
  if (!hostname || !domain) return false;
  
  const lowerHost = hostname.toLowerCase();
  const lowerDomain = domain.toLowerCase();
  
  // Server must end with .domain
  return lowerHost.endsWith(`.${lowerDomain}`) &&
         isValidFQDN(hostname);
}

// Usage examples
isValidServerName('server.company.com', 'company.com')       // ✅ true
isValidServerName('db.internal.company.com', 'company.com')  // ✅ true
isValidServerName('server.other.com', 'company.com')         // ❌ false
```

**`escapeHtml(unsafe: string): string`**
Prevents XSS attacks by escaping HTML entities:

```typescript
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Usage example - Safe display of user input
const userInput = '<script>alert("XSS")</script>';
const safe = escapeHtml(userInput);
// Result: "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"

// Used when displaying host descriptions
descriptionEl.textContent = escapeHtml(host.description);
```

**`validateCredentials(username: string, password: string): string | null`**
Validates login credentials, returning error message or null:

```typescript
export function validateCredentials(
  username: string,
  password: string
): string | null {
  if (!username.trim()) {
    return 'Username is required';
  }
  if (!password.trim()) {
    return 'Password is required';
  }
  if (username.length < 3) {
    return 'Username must be at least 3 characters';
  }
  return null; // Valid
}

// Usage in login form
const error = validateCredentials(usernameInput.value, passwordInput.value);
if (error) {
  showNotification(error, 'error');
  return;
}
```

**Test Coverage:**
- `validation.test.ts`: 101 unit tests covering edge cases
- `validation.property.test.ts`: Property-based tests using `fast-check` for fuzzing with 10,000+ generated inputs

---

### 5.12.2 UI Module (`ui.ts`)

**Purpose:** Consistent UI interactions across all windows

The UI module provides unified notification handling, button state management, and form utilities. With 74 unit tests, it ensures consistent behavior across main, login, hosts, about, and error windows.

**Core Functions:**

**`showNotification(message: string, type: NotificationType, options?: NotificationOptions)`**
Displays toast notifications with DaisyUI styling:

```typescript
type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationOptions {
  duration?: number;      // Auto-dismiss time (ms), default 3000
  position?: 'top' | 'bottom';  // Default 'top'
}

export function showNotification(
  message: string,
  type: NotificationType,
  options: NotificationOptions = {}
): void {
  const { duration = 3000, position = 'top' } = options;
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `alert ${getNotificationColorClasses(type)} 
    shadow-lg max-w-md animate-slide-in`;
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'polite');
  
  // Note: We intentionally don't display 'error' type
  // Error notifications route to error window for detailed display
  if (type !== 'error') {
    const icon = getIconForType(type);
    notification.innerHTML = `
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        ${icon}
      </svg>
      <span>${escapeHtml(message)}</span>
    `;
  } else {
    notification.innerHTML = `<span>${escapeHtml(message)}</span>`;
  }
  
  // Position notification
  const container = document.getElementById(`notification-container-${position}`);
  if (container) {
    container.appendChild(notification);
  }
  
  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      notification.classList.add('animate-slide-out');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
}

// Usage examples
showNotification('Host added successfully', 'success');
showNotification('Connecting to server...', 'info', { duration: 5000 });
showNotification('Invalid hostname format', 'warning');
showNotification('Connection failed', 'error', { position: 'bottom' });
```

**`getNotificationColorClasses(type: NotificationType): string`**
Returns DaisyUI-compatible CSS classes:

```typescript
export function getNotificationColorClasses(type: NotificationType): string {
  switch (type) {
    case 'success': return 'alert-success text-success-content';
    case 'error':   return 'alert-error text-error-content';
    case 'info':    return 'alert-info text-info-content';
    case 'warning': return 'alert-warning text-warning-content';
  }
}
```

**`setButtonsEnabled(enabled: boolean, ...buttons: HTMLButtonElement[])`**
Manages button state during async operations:

```typescript
export function setButtonsEnabled(
  enabled: boolean,
  ...buttons: HTMLButtonElement[]
): void {
  buttons.forEach(button => {
    button.disabled = !enabled;
    
    if (enabled) {
      button.classList.remove('loading');
    } else {
      button.classList.add('loading');
    }
  });
}

// Usage example - Prevent double-clicks during RDP launch
const connectButton = document.getElementById('connectBtn') as HTMLButtonElement;
const cancelButton = document.getElementById('cancelBtn') as HTMLButtonElement;

setButtonsEnabled(false, connectButton, cancelButton);

try {
  await invoke('launch_rdp_session', { hostname });
  showNotification('Connected successfully', 'success');
} finally {
  setButtonsEnabled(true, connectButton, cancelButton);
}
```

**`getFormData(formId: string): Record<string, string>`**
Extracts form data safely:

```typescript
export function getFormData(formId: string): Record<string, string> {
  const form = document.getElementById(formId) as HTMLFormElement;
  if (!form) return {};
  
  const formData = new FormData(form);
  const data: Record<string, string> = {};
  
  formData.forEach((value, key) => {
    data[key] = value.toString().trim();
  });
  
  return data;
}

// Usage
const loginData = getFormData('loginForm');
// { username: 'alice', password: '***', domain: 'company.com' }
```

**`clearForm(formId: string): void`**
Resets form to initial state:

```typescript
export function clearForm(formId: string): void {
  const form = document.getElementById(formId) as HTMLFormElement;
  if (form) {
    form.reset();
    
    // Also clear any validation states
    form.querySelectorAll('.input-error').forEach(el => {
      el.classList.remove('input-error');
    });
  }
}
```

**Custom Dialog System:**

QuickConnect replaces all browser `confirm()` and `alert()` calls with custom DaisyUI-themed dialogs for a consistent, professional appearance:

**`showCustomDialog(options: CustomDialogOptions): Promise<boolean>`**

```typescript
export type DialogType = 'confirm' | 'alert';
export type DialogIcon = 'warning' | 'info' | 'error' | 'success';

export interface CustomDialogOptions {
  title: string;
  message: string;
  type: DialogType;
  icon?: DialogIcon;
  confirmText?: string;
  cancelText?: string;
}

// Confirmation dialog
const confirmed = await showCustomDialog({
  title: 'Delete Host',
  message: 'Are you sure you want to delete this host?',
  type: 'confirm',
  icon: 'warning',
  confirmText: 'Delete',
  cancelText: 'Cancel'
});

if (confirmed) {
  await invoke('delete_host', { hostname });
}

// Alert dialog
await showCustomDialog({
  title: 'Validation Error',
  message: 'Hostname must not exceed 253 characters',
  type: 'alert',
  icon: 'error'
});
```

**Features:**
- DaisyUI-themed modals matching application style
- Icons for different severity levels (warning, info, error, success)
- ESC key support for dismissal
- Smooth fade-in/fade-out animations
- Proper button styling (red for dangerous actions, primary for normal)
- Preserves line breaks in messages
- Minimum width (400px) and maximum width (512px) for readability
- No max-height restriction to prevent scrollbars
- Focus management for keyboard accessibility

**Test Coverage:**
- `ui.test.ts`: 87 tests including 15 custom dialog tests
- `ui-main.test.ts`, `ui-login.test.ts`, `ui-hosts.test.ts`: Integration tests for window-specific behavior

---

### 5.12.3 Errors Module (`errors.ts`)

**Purpose:** Error categorization and visual representation

The errors module provides sophisticated error handling, categorizing errors by severity and generating appropriate CSS classes for the error window. With 85 unit tests, it ensures consistent error display across all scenarios.

**Core Functions:**

**`getSeverityFromCategory(category: string): 'critical' | 'error' | 'warning' | 'info'`**
Maps error categories to severity levels:

```typescript
export function getSeverityFromCategory(
  category: string
): 'critical' | 'error' | 'warning' | 'info' {
  const lowerCategory = category.toLowerCase();
  
  if (lowerCategory.includes('critical') || 
      lowerCategory.includes('fatal')) {
    return 'critical';
  }
  
  if (lowerCategory.includes('error') || 
      lowerCategory.includes('fail')) {
    return 'error';
  }
  
  if (lowerCategory.includes('warn')) {
    return 'warning';
  }
  
  return 'info';
}

// Usage examples
getSeverityFromCategory('Authentication')      // 'error'
getSeverityFromCategory('Network Failure')     // 'error'
getSeverityFromCategory('Configuration')       // 'info'
getSeverityFromCategory('Critical System Error') // 'critical'
```

**`getSeverityColor(severity: string): string`**
Returns DaisyUI badge color classes:

```typescript
export function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return 'badge-error';
    case 'error':    return 'badge-error';
    case 'warning':  return 'badge-warning';
    case 'info':     return 'badge-info';
    default:         return 'badge-neutral';
  }
}

// Usage in error display
const badge = document.createElement('span');
badge.className = `badge ${getSeverityColor(error.severity)}`;
badge.textContent = error.severity.toUpperCase();
```

**`getBorderColor(severity: string): string`**
Returns Tailwind CSS border classes with dark mode support:

```typescript
export function getBorderColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return 'border-error dark:border-error';
    case 'error':    return 'border-error dark:border-error';
    case 'warning':  return 'border-warning dark:border-warning';
    case 'info':     return 'border-info dark:border-info';
    default:         return 'border-neutral dark:border-neutral-700';
  }
}

// Usage in error card
errorCard.className = `card border-l-4 ${getBorderColor(error.severity)}`;
```

**`filterErrors(errors: ErrorInfo[], searchTerm: string): ErrorInfo[]`**
Case-insensitive search across all error fields:

```typescript
interface ErrorInfo {
  category: string;
  message: string;
  details?: string;
  timestamp: string;
  severity: string;
}

export function filterErrors(
  errors: ErrorInfo[],
  searchTerm: string
): ErrorInfo[] {
  if (!searchTerm.trim()) return errors;
  
  const term = searchTerm.toLowerCase();
  
  return errors.filter(error => 
    error.category.toLowerCase().includes(term) ||
    error.message.toLowerCase().includes(term) ||
    error.details?.toLowerCase().includes(term) ||
    error.timestamp.toLowerCase().includes(term)
  );
}

// Usage with search input
const searchInput = document.getElementById('errorSearch') as HTMLInputElement;
searchInput.addEventListener('input', (e) => {
  const filtered = filterErrors(allErrors, e.target.value);
  renderErrors(filtered);
});
```

**`sortErrors(errors: ErrorInfo[], sortBy: 'timestamp' | 'severity' | 'category'): ErrorInfo[]`**
Sorts errors by specified field:

```typescript
export function sortErrors(
  errors: ErrorInfo[],
  sortBy: 'timestamp' | 'severity' | 'category'
): ErrorInfo[] {
  const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
  
  return [...errors].sort((a, b) => {
    if (sortBy === 'severity') {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    if (sortBy === 'timestamp') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    return a.category.localeCompare(b.category);
  });
}
```

**Test Coverage:**
- `errors.test.ts`: 85 tests covering severity mapping, CSS generation, filtering, and edge cases

---

### 5.12.4 Hosts Module (`hosts.ts`)

**Purpose:** Host filtering, sorting, and display logic

The hosts module provides high-performance filtering and sorting for large host lists (tested with 1000+ hosts). With 61 unit tests, it ensures consistent search highlighting and date handling.

**Core Functions:**

**`filterHosts(hosts: Host[], searchTerm: string): Host[]`**
Case-insensitive search across hostname and description:

```typescript
interface Host {
  hostname: string;
  description: string;
  last_connected?: string;
}

export function filterHosts(hosts: Host[], searchTerm: string): Host[] {
  if (!searchTerm.trim()) return hosts;
  
  const term = searchTerm.toLowerCase();
  
  return hosts.filter(host =>
    host.hostname.toLowerCase().includes(term) ||
    host.description.toLowerCase().includes(term)
  );
}

// Usage example
const searchInput = document.getElementById('hostSearch') as HTMLInputElement;
searchInput.addEventListener('input', (e) => {
  const filtered = filterHosts(allHosts, e.target.value);
  renderHosts(filtered);
});
```

**`highlightMatches(text: string, searchTerm: string): string`**
Wraps matching text in `<mark>` tags for visual highlighting:

```typescript
export function highlightMatches(text: string, searchTerm: string): string {
  if (!searchTerm.trim()) return escapeHtml(text);
  
  const escaped = escapeHtml(text);
  const term = escapeHtml(searchTerm);
  
  // Case-insensitive replace with highlight
  const regex = new RegExp(`(${term})`, 'gi');
  return escaped.replace(regex, '<mark class="bg-yellow-300 dark:bg-yellow-600">$1</mark>');
}

// Usage in host display
hostCard.innerHTML = `
  <h3>${highlightMatches(host.hostname, searchTerm)}</h3>
  <p>${highlightMatches(host.description, searchTerm)}</p>
`;
// Result: "db-<mark>server</mark>-01.company.com" when searching "server"
```

**`sortHostsByHostname(hosts: Host[], ascending: boolean = true): Host[]`**
Alphabetical sorting by hostname:

```typescript
export function sortHostsByHostname(
  hosts: Host[],
  ascending: boolean = true
): Host[] {
  return [...hosts].sort((a, b) => {
    const compare = a.hostname.localeCompare(b.hostname);
    return ascending ? compare : -compare;
  });
}
```

**`sortHostsByLastConnected(hosts: Host[], ascending: boolean = false): Host[]`**
Sorts by last connection date (most recent first by default):

```typescript
export function sortHostsByLastConnected(
  hosts: Host[],
  ascending: boolean = false
): Host[] {
  return [...hosts].sort((a, b) => {
    // Hosts without dates go to end
    if (!a.last_connected && !b.last_connected) return 0;
    if (!a.last_connected) return 1;
    if (!b.last_connected) return -1;
    
    const dateA = parseDate(a.last_connected).getTime();
    const dateB = parseDate(b.last_connected).getTime();
    
    return ascending ? (dateA - dateB) : (dateB - dateA);
  });
}

// Usage example
const sortedHosts = sortHostsByLastConnected(allHosts);
// Most recently connected hosts appear first
```

**`parseDate(dateStr: string): Date`**
Parses UK format dates (DD/MM/YYYY HH:MM:SS):

```typescript
export function parseDate(dateStr: string): Date {
  // Format: "14/12/2024 09:30:45"
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  
  return new Date(year, month - 1, day, hours, minutes, seconds);
}
```

**`formatDate(date: Date): string`**
Formats date to UK format:

```typescript
export function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Usage
const now = new Date();
formatDate(now); // "14/12/2024 09:30:45"
```

**`hasDuplicateHostname(hosts: Host[], hostname: string, excludeIndex?: number): boolean`**
Checks for hostname conflicts:

```typescript
export function hasDuplicateHostname(
  hosts: Host[],
  hostname: string,
  excludeIndex?: number
): boolean {
  return hosts.some((host, index) => {
    if (excludeIndex !== undefined && index === excludeIndex) {
      return false; // Skip the host being edited
    }
    return host.hostname.toLowerCase() === hostname.toLowerCase();
  });
}

// Usage when adding/editing hosts
if (hasDuplicateHostname(allHosts, newHostname)) {
  showNotification('Hostname already exists', 'error');
  return;
}
```

**Test Coverage:**
- `hosts.test.ts`: 61 tests covering filtering, sorting, date parsing, and edge cases with special characters

---

### 5.12.5 Module Integration Example

Here's how these modules work together in a complete workflow:

```typescript
// main.ts - Host management workflow
import {
  isValidFQDN,
  escapeHtml,
  showNotification,
  setButtonsEnabled,
  filterHosts,
  sortHostsByLastConnected,
  highlightMatches,
  getSeverityFromCategory
} from './utils';

async function addHost() {
  const hostnameInput = document.getElementById('hostname') as HTMLInputElement;
  const descInput = document.getElementById('description') as HTMLInputElement;
  const addButton = document.getElementById('addBtn') as HTMLButtonElement;
  
  const hostname = hostnameInput.value.trim();
  const description = descInput.value.trim();
  
  // Validation
  if (!isValidFQDN(hostname)) {
    showNotification('Invalid hostname format. Must be a valid FQDN.', 'warning');
    hostnameInput.focus();
    return;
  }
  
  // Disable UI during operation
  setButtonsEnabled(false, addButton);
  
  try {
    await invoke('create_host', {
      hostname: escapeHtml(hostname),
      description: escapeHtml(description)
    });
    
    showNotification('Host added successfully', 'success');
    
    // Refresh and sort list
    const hosts = await invoke<Host[]>('get_all_hosts');
    const sorted = sortHostsByLastConnected(hosts);
    renderHosts(sorted);
    
    // Clear form
    hostnameInput.value = '';
    descInput.value = '';
    
  } catch (error) {
    const severity = getSeverityFromCategory('Host Management');
    showNotification(`Failed to add host: ${error}`, 'error');
    
    // Log to error window
    await invoke('log_error', {
      category: 'Host Management',
      message: `Failed to add host ${hostname}`,
      details: String(error),
      severity
    });
    
  } finally {
    setButtonsEnabled(true, addButton);
  }
}

function renderHosts(hosts: Host[]) {
  const searchTerm = (document.getElementById('search') as HTMLInputElement).value;
  const filtered = filterHosts(hosts, searchTerm);
  const container = document.getElementById('hostsList');
  
  container.innerHTML = filtered.map(host => `
    <div class="card bg-base-200">
      <div class="card-body">
        <h3 class="card-title">${highlightMatches(host.hostname, searchTerm)}</h3>
        <p>${highlightMatches(host.description, searchTerm)}</p>
        ${host.last_connected ? `<small>Last: ${host.last_connected}</small>` : ''}
      </div>
    </div>
  `).join('');
}
```

---

### Key Benefits of This Architecture

✅ **Separation of Concerns**
- Business logic separated from UI
- Each module has single responsibility
- Easy to locate and modify functionality

✅ **Testability**
- Pure functions with predictable outputs
- 660 tests across 9 test files
- Property-based testing for validation
- 80% code coverage enforced

✅ **Reusability**
- Functions used across multiple windows
- Consistent behavior everywhere
- No code duplication

✅ **Type Safety**
- Full TypeScript coverage
- IntelliSense support
- Compile-time error detection

✅ **Performance**
- Optimized for 1000+ hosts
- Efficient filtering and sorting
- Minimal DOM manipulation

---

## 5.13 Key Takeaways

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

✅ **Frontend utility modules provide reusable functionality**
- `validation.ts` - Input validation and XSS prevention (101 tests)
- `ui.ts` - Notifications and UI interactions (74 tests)
- `errors.ts` - Error categorization and styling (85 tests)
- `hosts.ts` - Filtering, sorting, and display logic (61 tests)
- 660 tests ensure reliability across all modules

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

