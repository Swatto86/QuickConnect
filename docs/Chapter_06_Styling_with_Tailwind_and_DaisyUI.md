# Chapter 6: Styling with Tailwind CSS and DaisyUI

**Estimated Reading Time:** 20-25 minutes  
**Difficulty Level:** Beginner to Intermediate

---

## Introduction

In previous chapters, we built functional Tauri applications with TypeScript. Now it's time to make them beautiful! Modern users expect applications to look polished and professional. In this chapter, we'll explore how QuickConnect uses **Tailwind CSS** and **DaisyUI** to create an attractive, responsive interface with minimal custom CSS.

By the end of this chapter, you'll understand:
- How to integrate Tailwind CSS into a Tauri project
- The role of PostCSS in processing styles
- Using DaisyUI for pre-built components
- Creating custom themes with consistent color schemes
- Building responsive layouts that adapt to different window sizes

---

## 6.1 Installing and Setting Up Tailwind CSS

### What is Tailwind CSS?

Tailwind CSS is a **utility-first CSS framework** that provides low-level utility classes to build custom designs without writing CSS. Instead of writing:

```css
/* Traditional CSS */
.button {
  background-color: #0066ff;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 600;
}
```

With Tailwind, you write HTML with utility classes:

```html
<!-- Tailwind CSS approach -->
<button class="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold">
  Click Me
</button>
```

**Benefits for Tauri Applications:**
- **Small bundle sizes** - Tailwind removes unused CSS in production
- **Consistency** - Predefined spacing, colors, and sizing scales
- **Rapid development** - No context switching between HTML and CSS files
- **Responsive design** - Built-in breakpoints (`sm:`, `md:`, `lg:`, etc.)
- **Theme support** - Easy to implement dark/light modes

### Installation Steps

Let's set up Tailwind in a Tauri project step by step.

**1. Install Tailwind and its dependencies:**

```bash
npm install -D tailwindcss postcss autoprefixer
```

- `tailwindcss` - The core framework
- `postcss` - CSS transformation tool
- `autoprefixer` - Adds vendor prefixes for browser compatibility

**2. Initialize Tailwind configuration:**

```bash
npx tailwindcss init
```

This creates `tailwind.config.js` in your project root.

**3. Create your CSS entry point:**

Create `src/styles.css` with Tailwind directives:

```css
/* src/styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Let's break down each directive:

- `@tailwind base;` - Normalizes browser styles (resets margins, paddings, etc.)
- `@tailwind components;` - Injects component classes (from plugins like DaisyUI)
- `@tailwind utilities;` - Adds all utility classes (colors, spacing, flexbox, etc.)

**4. Link the stylesheet in your HTML:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="/src/styles.css" />
    <title>My Tauri App</title>
  </head>
  <body>
    <!-- Your app content -->
  </body>
</html>
```

**5. Configure Vite to process Tailwind:**

Vite (Tauri's default bundler) automatically processes CSS files, but we need to tell Tailwind which files to scan for class names.

### Understanding Content Paths

Tailwind needs to know which files contain HTML classes so it can generate only the CSS you actually use. This is called **tree-shaking** and dramatically reduces bundle size.

**Basic Configuration:**

```javascript
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**QuickConnect's Configuration:**

```javascript
// tailwind.config.js
export default {
  content: [
    "./index.html",
    "./main.html",
    "./hosts.html",
    "./about.html",
    "./error.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ... rest of config
}
```

QuickConnect explicitly lists all HTML files because it uses multiple windows. Each window has its own HTML file, and Tailwind needs to scan all of them.

**Why this matters:**
- If you use a Tailwind class in `hosts.html` but don't include it in `content`, that class won't be generated
- In development, Tailwind generates all classes for convenience
- In production builds, only used classes are included

---

## 6.2 Configuring PostCSS

### What is PostCSS?

PostCSS is a tool that transforms CSS using JavaScript plugins. Think of it as a preprocessor (like Sass) but more flexible. Tailwind is actually a PostCSS plugin!

### The PostCSS Pipeline

When you build your Tauri app, your CSS goes through this pipeline:

```
styles.css → PostCSS → Tailwind Plugin → Autoprefixer → Final CSS
```

1. **Input:** Your `styles.css` with `@tailwind` directives
2. **Tailwind:** Expands directives into thousands of utility classes
3. **Autoprefixer:** Adds vendor prefixes (`-webkit-`, `-moz-`, etc.)
4. **Output:** Browser-ready CSS file

### QuickConnect's PostCSS Configuration

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

This minimal configuration is all you need! It tells PostCSS to:
1. Run the Tailwind plugin (which reads `tailwind.config.js`)
2. Run Autoprefixer to ensure cross-browser compatibility

### When You Need More Plugins

Some projects add additional PostCSS plugins:

```javascript
// Advanced example (not in QuickConnect)
export default {
  plugins: {
    'postcss-import': {},      // Allows @import statements
    tailwindcss: {},
    autoprefixer: {},
    cssnano: {},               // Minifies CSS in production
  },
}
```

For most Tauri apps, the basic configuration is sufficient because:
- Vite handles imports automatically
- Vite minifies CSS in production builds
- Tailwind's built-in optimizations are excellent

### Development vs Production

**In Development:**
- PostCSS runs on every file change
- Vite's HMR (Hot Module Replacement) updates styles instantly
- Full Tailwind CSS is generated for convenience

**In Production Build:**
- PostCSS runs once during `tauri build`
- Tailwind purges unused CSS (reduces size by 95%+)
- Autoprefixer adds necessary vendor prefixes
- Vite minifies and optimizes the output

---

## 6.3 Integrating DaisyUI Component Library

### What is DaisyUI?

DaisyUI is a **component library built on top of Tailwind CSS**. While Tailwind provides low-level utilities, DaisyUI provides pre-styled components like buttons, cards, modals, and forms.

**Think of it this way:**
- **Tailwind** = Building blocks (LEGO pieces)
- **DaisyUI** = Pre-assembled components (LEGO sets)

**QuickConnect's Custom Blue Gradient:**

While QuickConnect uses the built-in dark theme, it customizes the primary button appearance with CSS gradients defined in `styles.css` (covered in section 6.6).

### Why DaisyUI for Desktop Applications?

1. **Semantic class names:** `btn btn-primary` instead of `px-4 py-2 bg-blue-600 rounded...`
2. **Theme system:** Switch between themes with a single attribute
3. **Consistent components:** Buttons, inputs, modals look cohesive
4. **Less custom CSS:** Reduces maintenance burden
5. **Accessibility:** Components follow ARIA guidelines

### Installation

```bash
npm install -D daisyui
```

Add DaisyUI to your Tailwind configuration:

```javascript
// tailwind.config.js
import daisyui from "daisyui";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  plugins: [daisyui],
}
```

### Core DaisyUI Components Used in QuickConnect

#### 1. Buttons

DaisyUI provides semantic button styles:

```html
<!-- Basic buttons -->
<button class="btn">Normal Button</button>
<button class="btn btn-primary">Primary Action</button>
<button class="btn btn-error">Delete Action</button>
<button class="btn btn-ghost">Subtle Button</button>

<!-- Button sizes -->
<button class="btn btn-sm">Small</button>
<button class="btn btn-lg">Large</button>

<!-- Button states -->
<button class="btn" disabled>Disabled</button>
<button class="btn btn-circle">Icon</button>
```

**QuickConnect Example (Login Window):**

```html
<div class="flex justify-between space-x-2">
  <button type="button" id="delete-btn" tabindex="5" class="btn btn-error flex-1" disabled>
    Delete
  </button>
  <button type="button" id="cancel-btn" tabindex="4" class="btn btn-circle flex-1">
    Cancel
  </button>
  <button type="submit" tabindex="3" class="btn btn-primary flex-1" disabled>
    OK
  </button>
</div>
```

Notice:
- `btn-error` for destructive actions (red)
- `btn-circle` for neutral actions (gray)
- `btn-primary` for main actions (blue)
- `flex-1` makes buttons equal width

#### 2. Form Inputs

DaisyUI styles form elements consistently:

```html
<!-- Text input -->
<input type="text" class="input input-bordered w-full" placeholder="Enter text" />

<!-- Textarea -->
<textarea class="textarea textarea-bordered w-full"></textarea>

<!-- Select dropdown -->
<select class="select select-bordered w-full">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

**QuickConnect Example (Login Form):**

```html
<label for="username" class="block text-sm font-medium text-base-content">
  Username
</label>
<input
  type="text" id="username" name="username" tabindex="1" maxlength="104"
  class="input input-bordered w-full mt-1" placeholder="Enter username" />
```

Key classes:
- `input` - Base input styling
- `input-bordered` - Adds border (some themes have borderless inputs by default)
- `w-full` - Full width (Tailwind utility)
- `mt-1` - Margin top (Tailwind utility)

#### 3. Modals/Dialogs

DaisyUI integrates with native `<dialog>` elements:

```html
<dialog id="myModal" class="modal">
  <div class="modal-box">
    <h3 class="text-2xl font-bold mb-4">Modal Title</h3>
    <p>Modal content goes here...</p>
    <div class="modal-action">
      <button class="btn" onclick="myModal.close()">Close</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </div>
</dialog>

<button onclick="myModal.showModal()" class="btn">
  Open Modal
</button>
```

**QuickConnect Example (Host Management):**

```html
<dialog id="hostModal" class="modal">
    <div class="modal-backdrop bg-base-200 bg-opacity-50"></div>
    <div class="modal-box max-w-2xl w-11/12 bg-base-100 shadow-xl p-8 rounded-2xl border border-base-300">
        <h3 id="modalTitle" class="text-2xl font-bold mb-8 text-center">
            Edit Host
        </h3>
        <form id="hostForm" class="space-y-6" autocomplete="off">
            <div class="space-y-4">
                <label class="label">
                    <span class="label-text text-base">RDP Hostname</span>
                </label>
                <input type="text" id="hostname" name="hostname" tabindex="1"
                    class="input input-bordered w-full rounded-xl py-6" required autocomplete="off"
                    maxlength="253" placeholder="server.domain.com" />
            </div>
            <div class="space-y-4 mb-6">
                <label class="label">
                    <span class="label-text text-base">Description</span>
                </label>
                <textarea id="description" name="description" tabindex="2"
                    class="textarea textarea-bordered w-full h-32 rounded-xl" autocomplete="off"
                    maxlength="500"></textarea>
            </div>
            <div class="modal-action pt-4 flex justify-between">
                <button type="button" tabindex="4" class="btn btn-circle w-24" id="hostModalCancel">
                    Cancel
                </button>
                <button type="submit" class="btn btn-primary rounded-xl w-24" tabindex="3">
                    Save
                </button>
            </div>
        </form>
    </div>
</dialog>
```

Features:
- Native `<dialog>` element (better accessibility)
- `modal-box` centers and styles the content
- `modal-action` aligns buttons at the bottom
- `onclick="hostModal.close()"` closes the modal

#### 4. Tables

DaisyUI provides clean table styling:

```html
<table class="table w-full">
  <thead>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data 1</td>
      <td>Data 2</td>
      <td>
        <button class="btn btn-sm">Edit</button>
      </td>
    </tr>
  </tbody>
</table>
```

**QuickConnect Hosts Table:**

```html
<table class="table w-full" id="hostsTable">
  <thead class="border-b border-base-300">
    <tr>
      <th class="text-center w-[25%]">Connection String</th>
      <th class="text-center w-[35%]">Description</th>
      <th class="text-center w-[20%]">Last Connected</th>
      <th class="text-center w-[20%]">Actions</th>
    </tr>
  </thead>
  <tbody>
    <!-- JavaScript populates rows dynamically -->
  </tbody>
</table>
```

Notice:
- `w-[25%]` - Custom width percentages (Tailwind arbitrary values)
- `text-center` - Center align text
- `border-b border-base-300` - Bottom border with theme color

### Installing Additional DaisyUI Plugins

QuickConnect also uses the Tailwind Forms plugin for better form styling:

```bash
npm install -D @tailwindcss/forms
```

```javascript
// tailwind.config.js
import forms from "@tailwindcss/forms";
import daisyui from "daisyui";

export default {
  plugins: [forms, daisyui],
}
```

The Forms plugin provides better default styles for inputs, checkboxes, radio buttons, and selects.

---

## 6.4 Creating a Custom Theme System

One of DaisyUI's most powerful features is its theme system. Instead of hard-coding colors everywhere, you define a theme with semantic color names, and DaisyUI handles the rest.

### Understanding DaisyUI Theme Structure

DaisyUI themes use semantic color names:

- **`primary`** - Main brand color (used for primary buttons, links)
- **`secondary`** - Accent color for secondary actions
- **`accent`** - Highlight color for special elements
- **`neutral`** - For text and borders
- **`base-100`, `base-200`, `base-300`** - Background layers
- **`info`, `success`, `warning`, `error`** - Feedback colors

### QuickConnect's Theme Configuration

QuickConnect uses DaisyUI's built-in dark theme with custom styling:

```javascript
// tailwind.config.js
export default {
  // ... other config
  plugins: [forms, daisyui],
  daisyui: {
    themes: [
      "light",  // Include built-in light theme
      "dark",   // Include built-in dark theme
    ],
    darkTheme: "dark", // Default dark theme
  },
}
```

### How Theme Colors Are Used

When you use DaisyUI component classes, they reference theme colors:

```html
<!-- These buttons automatically use theme colors -->
<button class="btn btn-primary">Uses #0066ff</button>
<button class="btn btn-error">Uses #ff5630</button>

<!-- Backgrounds reference base colors -->
<div class="bg-base-100">Darkest background (#1a1d24)</div>
<div class="bg-base-200">Card background (#24272f)</div>
<div class="bg-base-300">Element background (#2a2e37)</div>

<!-- Text uses content colors -->
<p class="text-base-content">Automatic contrast text</p>
```

### Setting the Active Theme

Specify the theme using the `data-theme` attribute on the `<html>` element:

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
  <head>
    <!-- ... -->
  </head>
  <body>
    <!-- App uses dark theme -->
  </body>
</html>
```

**QuickConnect's approach:**

```html
<html lang="en" data-theme="dark">
```

The application uses DaisyUI's built-in `dark` theme, with additional custom styling defined in `styles.css`.

### Creating Theme Variants

You can create multiple theme variants for different use cases:

```javascript
daisyui: {
  themes: [
    {
      "light-mode": {
        "primary": "#0066ff",
        "base-100": "#ffffff",
        "base-content": "#000000",
      },
    },
    {
      "dark-mode": {
        "primary": "#0088ff",
        "base-100": "#1a1d24",
        "base-content": "#ffffff",
      },
    },
    {
      "high-contrast": {
        "primary": "#ffff00",
        "base-100": "#000000",
        "base-content": "#ffffff",
      },
    },
  ],
}
```

Then switch themes dynamically:

```typescript
// Switch to dark mode
document.documentElement.setAttribute('data-theme', 'dark-mode');

// Switch to high contrast
document.documentElement.setAttribute('data-theme', 'high-contrast');
```

### Extending Themes with Custom Colors

You can also extend Tailwind's color palette while keeping DaisyUI themes:

```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        'brand-blue': '#0066ff',
        'brand-dark': '#003d7a',
      },
      backgroundImage: {
        'gradient-blue': 'linear-gradient(135deg, #003d7a 0%, #0066cc 50%, #0088ff 100%)',
      },
    },
  },
  plugins: [daisyui],
}
```

Now you can use custom classes:

```html
<div class="bg-brand-blue">Custom blue background</div>
<div class="bg-gradient-blue">Custom gradient</div>
```

### QuickConnect's Custom Gradient

QuickConnect defines a custom gradient for primary buttons in `styles.css`:

```css
/* Custom blue gradient for primary buttons */
.btn-primary {
  background: linear-gradient(135deg, #003d7a 0%, #0066ff 50%, #0088ff 100%);
  border: none;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #002d5a 0%, #0055cc 50%, #0077dd 100%);
}

.btn-primary:active {
  background: linear-gradient(135deg, #002040 0%, #0044aa 50%, #0066bb 100%);
}
```

This overrides DaisyUI's default `btn-primary` styling with a branded gradient. Notice:
- **Base state:** Bright blue gradient
- **Hover state:** Slightly darker
- **Active state:** Even darker (pressed appearance)

### Theme Color Reference

Here's how DaisyUI theme colors map to components:

| Color | Used For |
|-------|----------|
| `primary` | Primary buttons, links, active states |
| `secondary` | Secondary buttons, alternate highlights |
| `accent` | Special features, call-to-action elements |
| `neutral` | Borders, dividers, subtle backgrounds |
| `base-100` | Main background |
| `base-200` | Card backgrounds, elevated surfaces |
| `base-300` | Input backgrounds, nested elements |
| `base-content` | Body text (auto-contrasts with base colors) |
| `info` | Information alerts, info badges |
| `success` | Success messages, completed states |
| `warning` | Warning messages, caution indicators |
| `error` | Error messages, destructive actions |

### Best Practices for Custom Themes

1. **Start with a built-in theme:** Modify an existing theme rather than building from scratch
2. **Maintain contrast ratios:** Ensure text is readable (WCAG AA minimum: 4.5:1)
3. **Test with components:** Preview buttons, forms, and modals before finalizing
4. **Use semantic names:** Don't name colors by appearance (`primary` vs `blue-500`)
5. **Provide fallbacks:** Include light and dark variants for accessibility
6. **Document your theme:** Note color decisions for future maintenance

---

## Summary

In this first half of Chapter 6, we've covered:

✅ **Installing Tailwind CSS** - Set up the utility-first CSS framework  
✅ **PostCSS Configuration** - Understand the CSS processing pipeline  
✅ **DaisyUI Integration** - Add pre-built components and themes  
✅ **Custom Theme Creation** - Build a branded color system

You now understand how QuickConnect achieves its polished appearance with minimal custom CSS. Tailwind provides the utilities, DaisyUI provides the components, and custom themes provide the brand identity.

In the next sections, we'll explore:
- Responsive design principles for desktop applications
- Creating custom components and utilities
- Implementing dark/light theme switching
- A complete walkthrough of QuickConnect's UI architecture

---

## 6.5 Responsive Design Principles for Desktop Applications

While responsive design is typically associated with mobile web development, desktop applications also benefit from responsive layouts. Users resize windows, use different monitor resolutions, and expect applications to adapt gracefully.

### Desktop vs Web Responsive Design

**Key Differences:**

| Web Responsive Design | Desktop App Responsive Design |
|----------------------|------------------------------|
| Mobile-first approach | Desktop-first approach |
| Touch targets (44px min) | Mouse precision (24px is fine) |
| Breakpoints: 320px to 1920px+ | Breakpoints: 800px to 1920px |
| Network considerations | Local assets (no loading delays) |
| Variable viewport heights | Consistent chrome/window controls |

### Tailwind Breakpoint System

Tailwind provides responsive utility variants using a mobile-first approach:

```html
<!-- Mobile first: base styles, then override at larger sizes -->
<div class="w-full md:w-1/2 lg:w-1/3">
  <!-- Full width on mobile, half on medium, third on large -->
</div>
```

**Default Tailwind Breakpoints:**

| Breakpoint | Min Width | Typical Use |
|------------|-----------|-------------|
| `sm:` | 640px | Small tablets |
| `md:` | 768px | Tablets, small laptops |
| `lg:` | 1024px | Laptops, desktops |
| `xl:` | 1280px | Large desktops |
| `2xl:` | 1536px | Ultra-wide monitors |

### QuickConnect Window Sizes

QuickConnect defines minimum and default window sizes in `tauri.conf.json`:

```json
{
  "windows": [
    {
      "label": "login",
      "width": 600,
      "height": 500,
      "resizable": false
    },
    {
      "label": "main",
      "title": "QuickConnect",
      "width": 800,
      "height": 400,
      "minWidth": 800,
      "minHeight": 400,
      "maximized": true
    },
    {
      "label": "hosts",
      "width": 800,
      "height": 400,
      "minWidth": 600,
      "minHeight": 500,
      "maximized": true
    },
    {
      "label": "error",
      "width": 700,
      "height": 500,
      "minWidth": 500,
      "minHeight": 400,
      "maximized": true
    }
  ]
}
```

This means:
- Login window is fixed at 600×500 (sized to accommodate custom dialogs)
- Main, hosts, and error windows open maximized for full-screen experience
- Users can't make windows smaller than their minimum sizes
- Design should work well from 600px to 1920px+ width

### Responsive Layout Patterns in QuickConnect

#### 1. Flexible Container Widths

**Login Window (index.html):**

```html
<form class="space-y-3 w-full max-w-md mx-auto p-4">
  <!-- Form content -->
</form>
```

Breakdown:
- `w-full` - Takes full width of parent
- `max-w-md` - Maximum width of 448px (Tailwind's `md` size)
- `mx-auto` - Centers horizontally with auto margins
- `p-4` - Padding of 1rem on all sides

**Result:** Form stays centered and readable, never becoming too wide on large monitors.

#### 2. Responsive Button Layouts

**Login Window Buttons:**

```html
<div class="flex justify-between space-x-2">
  <button class="btn btn-error flex-1">Delete</button>
  <button class="btn btn-circle flex-1">Cancel</button>
  <button class="btn btn-primary flex-1">OK</button>
</div>
```

- `flex` - Flexbox layout
- `justify-between` - Distributes space between buttons
- `space-x-2` - Horizontal gap of 0.5rem between buttons
- `flex-1` - Each button takes equal width

**On narrow windows:** Buttons shrink proportionally  
**On wide windows:** Buttons expand proportionally  
**Result:** Always balanced, never cramped or stretched awkwardly

#### 3. Responsive Tables

**Hosts Management Table:**

```html
<table class="table w-full">
  <thead>
    <tr>
      <th class="text-center w-[25%]">Connection String</th>
      <th class="text-center w-[35%]">Description</th>
      <th class="text-center w-[20%]">Last Connected</th>
      <th class="text-center w-[20%]">Actions</th>
    </tr>
  </thead>
</table>
```

- `w-[25%]` - Custom percentage widths using Tailwind arbitrary values
- Columns scale proportionally to window width
- `text-center` - Centers text for better appearance

**Advanced Responsive Tables:**

For apps that need more flexibility, you can hide columns on smaller screens:

```html
<table class="table w-full">
  <thead>
    <tr>
      <th>Name</th>
      <th class="hidden md:table-cell">Email</th>
      <th class="hidden lg:table-cell">Department</th>
      <th>Actions</th>
    </tr>
  </thead>
</table>
```

- `hidden` - Hide by default
- `md:table-cell` - Show on medium screens and up
- `lg:table-cell` - Show only on large screens and up

#### 4. Responsive Modal Sizing

**Host Edit Modal:**

```html
<dialog id="hostModal" class="modal">
  <div class="modal-box max-w-2xl w-11/12 bg-base-100 shadow-xl p-8">
    <!-- Modal content -->
  </div>
</dialog>
```

- `w-11/12` - Takes 91.67% of viewport width (leaves breathing room)
- `max-w-2xl` - Never exceeds 672px width
- Result: On small windows (800px), modal is ~730px; on large windows, capped at 672px

**Responsive Modal Example:**

```html
<div class="modal-box w-11/12 max-w-xs sm:max-w-md lg:max-w-2xl">
  <!-- Adjusts maximum width based on screen size -->
</div>
```

#### 5. Flexible Form Layouts

**Two-Column Forms:**

```html
<form class="space-y-4">
  <!-- Single column on small screens, two columns on large -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div>
      <label>First Name</label>
      <input type="text" class="input input-bordered w-full" />
    </div>
    <div>
      <label>Last Name</label>
      <input type="text" class="input input-bordered w-full" />
    </div>
  </div>
</form>
```

- `grid-cols-1` - One column by default
- `lg:grid-cols-2` - Two columns on large screens (1024px+)
- `gap-4` - 1rem gap between grid items

### Spacing System

Tailwind's spacing scale is consistent across all utilities:

| Class | Size | Pixels (at default font size) |
|-------|------|-------------------------------|
| `p-1` | 0.25rem | 4px |
| `p-2` | 0.5rem | 8px |
| `p-3` | 0.75rem | 12px |
| `p-4` | 1rem | 16px |
| `p-6` | 1.5rem | 24px |
| `p-8` | 2rem | 32px |

**QuickConnect's consistent spacing:**

```html
<!-- Login form uses space-y-3 (12px vertical spacing) -->
<form class="space-y-3">...</form>

<!-- Host modal uses space-y-6 (24px vertical spacing) -->
<form class="space-y-6">...</form>

<!-- Margin bottom consistent -->
<div class="mb-4">...</div>  <!-- 16px margin bottom -->
<div class="mb-6">...</div>  <!-- 24px margin bottom -->
```

### Flexbox vs Grid

**When to use Flexbox:**
- Single-dimension layouts (rows or columns)
- Content-driven sizing
- Navigation bars, button groups, simple forms

**QuickConnect Example:**

```html
<div class="flex justify-between items-center mb-6">
  <h1 class="text-2xl font-bold">Manage Server List</h1>
  <div class="flex items-center gap-2">
    <button class="btn btn-error">Delete All</button>
    <button class="btn btn-primary">Scan Domain</button>
    <button class="btn btn-accent">Add Host</button>
  </div>
</div>
```

**When to use Grid:**
- Two-dimensional layouts
- Precise control over rows and columns
- Card layouts, dashboards

**Grid Example:**

```html
<div class="grid grid-cols-3 gap-4">
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>
</div>
```

### Scrollable Regions

Desktop apps often need scrollable content areas with fixed headers/footers.

**QuickConnect's Scrollable Server List:**

```html
<main class="p-4 flex flex-col h-screen">
  <!-- Fixed header -->
  <div class="flex justify-between items-center mb-6">
    <h1>Connect to a Server</h1>
    <button>Manage Hosts</button>
  </div>

  <!-- Scrollable content -->
  <div class="flex-1 bg-base-200 rounded-lg overflow-hidden mb-16">
    <div class="h-full overflow-y-auto">
      <!-- Server list items -->
    </div>
  </div>

  <!-- Fixed footer -->
  <div class="fixed bottom-0 left-0 right-0 h-16">
    <button>Back</button>
  </div>
</main>
```

Key classes:
- `h-screen` - Full viewport height
- `flex-1` - Takes remaining space
- `overflow-hidden` - Clips overflow on container
- `overflow-y-auto` - Vertical scrollbar on inner div
- `mb-16` - Margin bottom to prevent overlap with fixed footer

### Responsive Text Sizing

Tailwind provides responsive text utilities:

```html
<!-- Responsive heading -->
<h1 class="text-xl md:text-2xl lg:text-3xl">
  Responsive Title
</h1>

<!-- Responsive body text -->
<p class="text-sm md:text-base">
  Responsive paragraph
</p>
```

**QuickConnect's approach:**

QuickConnect uses fixed text sizes since window size is controlled:

```html
<h1 class="text-2xl font-bold">Connect to a Server</h1>
<h2 class="text-2xl font-semibold">Enter Credentials</h2>
<label class="text-sm font-medium">Username</label>
```

This works because:
- Minimum window size is 800px
- Text remains readable at all supported sizes
- Consistency is more important than scaling

---

## 6.6 Custom Components and Utilities

While DaisyUI provides many components, you'll often need custom styles for specific use cases. Tailwind makes it easy to add custom utilities to your CSS.

### Adding Custom CSS to styles.css

QuickConnect's `styles.css` extends Tailwind with custom styles:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles below Tailwind directives */
```

### Custom Modal Backdrop

**The Problem:** Default `<dialog>` backdrop is too transparent.

**QuickConnect's Solution:**

```css
dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.5);
}
```

This makes the backdrop 50% opaque black, focusing attention on the modal.

### Custom Modal Layout

**Centering modal content:**

```css
.modal-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 1rem;
  padding: 2rem;
}

.modal-box h3 {
  text-align: center;
}

.modal-action {
  display: flex;
  justify-content: space-between;
}
```

This ensures:
- Modal content is vertically and horizontally centered
- Modal titles are centered
- Action buttons are spaced evenly

### Custom Button Styles

**Overriding DaisyUI button gradients:**

```css
.btn-primary {
  background: linear-gradient(135deg, #003d7a 0%, #0066ff 50%, #0088ff 100%);
  border: none;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #002d5a 0%, #0055cc 50%, #0077dd 100%);
}

.btn-primary:active {
  background: linear-gradient(135deg, #002040 0%, #0044aa 50%, #0066bb 100%);
}
```

**Why gradients?**
- More visually appealing than flat colors
- Provides depth and sophistication
- Matches modern UI design trends

### Improved Disabled Button Visibility

**The Problem:** Disabled buttons with `opacity-50` are hard to see.

**QuickConnect's Solution:**

```css
.btn:disabled,
.btn.opacity-50 {
  opacity: 1 !important;
  filter: grayscale(50%);
  cursor: not-allowed;
}
```

This approach:
- Keeps button fully opaque
- Uses grayscale filter to indicate disabled state
- Changes cursor to `not-allowed`
- More accessible than low opacity

### Custom Positioning for Messages

**"No hosts" message positioning:**

```css
#server-list {
  position: relative;
}

#noHostsMessage {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  width: 100%;
  pointer-events: none;
}
```

This perfectly centers the message in the server list area. `pointer-events: none` ensures clicks pass through to the container below.

### Creating Reusable Component Classes

You can create your own component classes in the `@layer` directive:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .card-primary {
    @apply bg-base-200 rounded-lg p-6 shadow-lg;
  }

  .btn-icon {
    @apply btn btn-circle btn-ghost w-10 h-10;
  }

  .input-group {
    @apply space-y-2 mb-4;
  }
}
```

Then use them like DaisyUI components:

```html
<div class="card-primary">
  <h3>Card Title</h3>
  <p>Card content</p>
</div>
```

### Extending Tailwind Configuration

Add custom utilities in `tailwind.config.js`:

```javascript
export default {
  theme: {
    extend: {
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
}
```

Now you can use:

```html
<div class="w-128 rounded-4xl backdrop-blur-xs">
  Custom sized, rounded, blurred element
</div>
```

### Using Arbitrary Values

Tailwind supports arbitrary values for one-off customizations:

```html
<!-- Custom sizes -->
<div class="w-[347px] h-[123px]">Exact dimensions</div>

<!-- Custom colors -->
<div class="bg-[#1a1d24] text-[#0066ff]">Custom colors</div>

<!-- Custom spacing -->
<div class="mt-[17px] p-[13px]">Precise spacing</div>

<!-- Custom grid columns -->
<div class="grid grid-cols-[200px_1fr_100px]">
  Custom grid template
</div>
```

**QuickConnect uses arbitrary values for table columns:**

```html
<th class="w-[25%]">Connection String</th>
<th class="w-[35%]">Description</th>
<th class="w-[20%]">Last Connected</th>
<th class="w-[20%]">Actions</th>
```

### Toast Notification Component

QuickConnect doesn't include toasts in the base chapter examples, but here's how you'd create one:

```css
@layer components {
  .toast {
    @apply fixed top-4 right-4 bg-base-100 p-4 rounded-lg shadow-xl;
    @apply border border-base-300 min-w-[300px] max-w-[500px];
    animation: slideInRight 0.3s ease-out;
  }

  .toast-success {
    @apply toast border-l-4 border-success;
  }

  .toast-error {
    @apply toast border-l-4 border-error;
  }
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

Usage:

```typescript
function showToast(message: string, type: 'success' | 'error') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}
```

---

## 6.7 Dark/Light Theme Switching

Many desktop applications offer theme switching to accommodate user preferences or match system themes. Let's explore how to implement this in a Tauri app with DaisyUI.

### Basic Theme Switching

**HTML Setup:**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
  <head>
    <!-- ... -->
  </head>
  <body>
    <button id="themeToggle" class="btn btn-circle">
      🌙 Toggle Theme
    </button>
  </body>
</html>
```

**TypeScript Implementation:**

```typescript
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

themeToggle?.addEventListener('click', () => {
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
});

// Load saved theme on startup
const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);
```

### Persisting Theme Across Windows

In multi-window applications like QuickConnect, you want theme changes to apply to all windows.

**Using Tauri Events:**

```typescript
import { emit, listen } from '@tauri-apps/api/event';

// Listen for theme changes from other windows
await listen('theme-changed', (event) => {
  const newTheme = event.payload as string;
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
});

// Toggle theme and notify other windows
async function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  // Notify other windows
  await emit('theme-changed', newTheme);
}
```

### System Theme Detection

Match the operating system's theme preference:

```typescript
// Detect system theme preference
function getSystemTheme(): 'light' | 'dark' {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const newTheme = e.matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
});

// Initialize with system theme if no preference saved
const savedTheme = localStorage.getItem('theme') || getSystemTheme();
document.documentElement.setAttribute('data-theme', savedTheme);
```

### Theme Switching with Animation

Add smooth transitions when switching themes:

```css
/* Add to styles.css */
html {
  transition: background-color 0.3s ease, color 0.3s ease;
}

.btn, .input, .card {
  transition: all 0.3s ease;
}
```

**Warning:** Don't overuse transitions on every element—it can cause performance issues. Apply selectively.

### Icon-Based Theme Toggle

Replace text with icons that change based on theme:

```html
<button id="themeToggle" class="btn btn-circle btn-ghost">
  <svg id="sunIcon" class="w-6 h-6 hidden" fill="currentColor" viewBox="0 0 20 20">
    <!-- Sun icon path -->
  </svg>
  <svg id="moonIcon" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
    <!-- Moon icon path -->
  </svg>
</button>
```

```typescript
function updateThemeIcon() {
  const theme = document.documentElement.getAttribute('data-theme');
  const sunIcon = document.getElementById('sunIcon');
  const moonIcon = document.getElementById('moonIcon');
  
  if (theme === 'dark') {
    sunIcon?.classList.add('hidden');
    moonIcon?.classList.remove('hidden');
  } else {
    sunIcon?.classList.remove('hidden');
    moonIcon?.classList.add('hidden');
  }
}
```

### QuickConnect's Approach

QuickConnect currently uses a fixed dark theme (`data-theme="dark"`) without switching. This is a valid design decision for applications with a specific brand identity. The blue gradient buttons and custom styling are applied via CSS in `styles.css` rather than through a custom DaisyUI theme.

**To add theme switching to QuickConnect:**

1. Add a theme toggle button to the system tray menu (covered in Chapter 14)
2. Use Windows Registry to persist the theme preference
3. Apply theme on startup in each window

---

## 6.8 QuickConnect UI Architecture Walkthrough

Let's do a complete walkthrough of QuickConnect's UI, analyzing how Tailwind and DaisyUI work together to create a cohesive application.

### Login Window (index.html)

**Purpose:** Credential input for RDP connections

**Layout Analysis:**

```html
<body class="min-h-screen bg-base-100 select-none flex flex-col">
  <div data-tauri-drag-region class="titlebar h-[16px]"></div>
  <main class="flex-1 flex flex-col items-center justify-center -mt-12">
    <form class="space-y-3 w-full max-w-md mx-auto p-4">
      <!-- Form content -->
    </form>
  </main>
</body>
```

**Breakdown:**

1. **Body:** 
   - `min-h-screen` - Fills viewport height
   - `bg-base-100` - Dark background from theme
   - `select-none` - Prevents text selection (desktop app feel)
   - `flex flex-col` - Vertical flexbox for titlebar + content

2. **Titlebar:**
   - `h-[16px]` - Small drag region for frameless window
   - `data-tauri-drag-region` - Makes area draggable

3. **Main:**
   - `flex-1` - Takes remaining vertical space
   - `flex flex-col items-center justify-center` - Centers form vertically and horizontally
   - `-mt-12` - Negative margin to visually center (accounts for titlebar)

4. **Form:**
   - `space-y-3` - 12px vertical spacing between children
   - `max-w-md` - Never wider than 448px
   - `mx-auto` - Horizontally centers
   - `p-4` - 16px padding

**Form Components:**

```html
<input
  type="text"
  id="username"
  class="input input-bordered w-full mt-1"
  placeholder="Enter username"
/>
```

- `input` - DaisyUI base input style
- `input-bordered` - Adds border
- `w-full` - Full width of container
- `mt-1` - 4px top margin for spacing from label

**Button Layout:**

```html
<div class="flex justify-between space-x-2">
  <button class="btn btn-error flex-1">Delete</button>
  <button class="btn btn-circle flex-1">Cancel</button>
  <button class="btn btn-primary flex-1">OK</button>
</div>
```

- `justify-between` - Distributes space
- `space-x-2` - 8px horizontal gap
- `flex-1` - Each button takes equal width

### Main Window (main.html)

**Purpose:** Server selection interface

**Header Section:**

```html
<div class="flex justify-between items-center mb-6">
  <h1 class="text-2xl font-bold">Connect to a Server</h1>
  <div class="flex items-center gap-2">
    <button class="btn btn-primary">Manage Hosts</button>
  </div>
</div>
```

- `justify-between` - Title on left, button on right
- `items-center` - Vertical alignment
- `mb-6` - 24px bottom margin
- `gap-2` - 8px gap between buttons (if multiple)

**Search Input:**

```html
<div class="mb-4">
  <input 
    type="text" 
    id="search-input" 
    placeholder="Search hosts by name or description..." 
    class="input input-bordered w-full"
  />
</div>
```

Standard DaisyUI input with full width.

**Scrollable Server List:**

```html
<div class="flex-1 bg-base-200 rounded-lg overflow-hidden mb-16">
  <div id="server-list" class="h-full overflow-y-auto">
    <!-- Dynamically populated -->
  </div>
</div>
```

- `flex-1` - Takes remaining vertical space
- `bg-base-200` - Lighter background for contrast
- `rounded-lg` - 8px border radius
- `overflow-hidden` - Clips inner scrollbar
- `h-full overflow-y-auto` - Enables vertical scrolling
- `mb-16` - Space for fixed footer (64px)

**Fixed Footer:**

```html
<div class="fixed bottom-0 left-0 right-0 h-16 bg-base-100 flex items-center px-4">
  <button class="btn btn-ghost btn-circle">←</button>
</div>
```

- `fixed bottom-0 left-0 right-0` - Pins to bottom, full width
- `h-16` - 64px height
- `flex items-center` - Centers button vertically
- `px-4` - 16px horizontal padding

### Hosts Management Window (hosts.html)

**Purpose:** Add, edit, delete server hosts

**Action Button Group:**

```html
<div class="flex items-center gap-2">
  <button class="btn btn-error">Delete All</button>
  <button class="btn btn-primary">Scan Domain</button>
  <button class="btn btn-accent">Add Host</button>
</div>
```

- Different button colors indicate action types
- `gap-2` - Consistent 8px spacing
- Semantic colors from theme (error=red, primary=blue, accent=light blue)

**Hosts Table:**

```html
<table class="table w-full">
  <thead class="border-b border-base-300">
    <tr>
      <th class="text-center w-[25%]">Connection String</th>
      <th class="text-center w-[35%]">Description</th>
      <th class="text-center w-[20%]">Last Connected</th>
      <th class="text-center w-[20%]">Actions</th>
    </tr>
  </thead>
  <tbody>
    <!-- JavaScript populates rows -->
  </tbody>
</table>
```

- `border-b border-base-300` - Bottom border on header
- `w-[25%]` etc. - Explicit column widths
- `text-center` - Centers text in cells

**Edit Host Modal:**

```html
<dialog id="hostModal" class="modal">
  <div class="modal-box max-w-2xl w-11/12 bg-base-100 shadow-xl p-8 rounded-2xl">
    <h3 class="text-2xl font-bold mb-8 text-center">Edit Host</h3>
    <form class="space-y-6">
      <div class="space-y-4">
        <label class="label">
          <span class="label-text text-base">RDP Hostname</span>
        </label>
        <input class="input input-bordered w-full rounded-xl py-6" />
      </div>
      <div class="modal-action pt-4 flex justify-between">
        <button class="btn btn-circle w-24">Cancel</button>
        <button class="btn btn-primary w-24">Save</button>
      </div>
    </form>
  </div>
</dialog>
```

**Key Design Decisions:**

1. **Generous spacing:** `space-y-6` (24px) makes form breathable
2. **Large inputs:** `py-6` (48px total height) for easy clicking
3. **Rounded corners:** `rounded-xl` (12px) for modern look
4. **Fixed button widths:** `w-24` ensures consistency
5. **Centered title:** `text-center` focuses attention

### Color Consistency

QuickConnect uses the built-in dark theme colors with custom CSS for buttons:

| Element | Color | Source |
|---------|-------|--------|
| Primary buttons | Blue gradient (#003d7a to #0088ff) | Custom CSS |
| Error buttons | Red | DaisyUI dark theme |
| Backgrounds | Dark grays | DaisyUI dark theme |
| Text | White/gray | DaisyUI dark theme |

### Spacing Consistency

QuickConnect uses a consistent spacing scale:

| Spacing | Size | Common Usage |
|---------|------|--------------|
| `gap-2`, `space-x-2` | 8px | Button groups, inline elements |
| `space-y-3` | 12px | Compact forms (login) |
| `mb-4`, `p-4` | 16px | Standard padding/margins |
| `space-y-6`, `mb-6` | 24px | Form sections, headers |
| `p-8`, `mb-8` | 32px | Modal padding, large sections |

### Typography Hierarchy

QuickConnect uses clear typography scale:

```html
<!-- Page titles -->
<h1 class="text-2xl font-bold">Manage Server List</h1>

<!-- Section titles -->
<h2 class="text-xl font-semibold">Section Title</h2>

<!-- Modal titles -->
<h3 class="text-2xl font-bold text-center">Modal Title</h3>

<!-- Labels -->
<label class="text-sm font-medium">Username</label>

<!-- Body text -->
<p class="text-base">Body text content</p>
```

---

## Summary

In this chapter, we explored how QuickConnect uses Tailwind CSS and DaisyUI to create a polished, professional interface:

✅ **6.1 Installing Tailwind** - Setup, configuration, content scanning  
✅ **6.2 PostCSS Configuration** - CSS processing pipeline  
✅ **6.3 DaisyUI Components** - Buttons, forms, modals, tables  
✅ **6.4 Custom Themes** - Configuring DaisyUI themes and customization  
✅ **6.5 Responsive Design** - Flexbox, grid, scrollable regions  
✅ **6.6 Custom Components** - Gradients, disabled button styles, custom utilities  
✅ **6.7 Theme Switching** - Light/dark modes, system theme detection  
✅ **6.8 UI Architecture** - Complete walkthrough of QuickConnect's interface  

### Key Takeaways

1. **Utility-first CSS** reduces custom CSS and speeds development
2. **Component libraries** like DaisyUI provide consistency
3. **Theme systems** enable brand identity and customization
4. **Responsive design** matters even for desktop applications
5. **Consistent spacing and typography** create professional UIs

### What's Next?

In **Chapter 7**, we'll explore **Multi-Window Applications**, learning how to:
- Define multiple windows in `tauri.conf.json`
- Create and manage windows from Rust
- Communicate between windows
- Handle window focus and visibility
- Implement the login → main → hosts flow

---

## Practice Exercises

Test your understanding of Tailwind CSS and DaisyUI with these hands-on exercises.

### Exercise 1: Create a Settings Panel

**Goal:** Build a settings panel with consistent styling.

**Requirements:**
- Card layout with padding
- Section headers
- Toggle switches for options
- Save/Cancel buttons at the bottom

**Hints:**
- Use DaisyUI's `card` components
- Use `toggle` class for switches
- Apply consistent spacing with `space-y-*`

**Solution:**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/src/styles.css" />
  <title>Settings</title>
</head>
<body class="min-h-screen bg-base-100 p-8">
  <div class="max-w-2xl mx-auto">
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-6">Application Settings</h2>
        
        <!-- Appearance Section -->
        <div class="space-y-4 mb-6">
          <h3 class="text-lg font-semibold">Appearance</h3>
          <div class="flex justify-between items-center">
            <span>Dark Mode</span>
            <input type="checkbox" class="toggle toggle-primary" checked />
          </div>
          <div class="flex justify-between items-center">
            <span>Compact View</span>
            <input type="checkbox" class="toggle toggle-primary" />
          </div>
        </div>

        <!-- Behavior Section -->
        <div class="space-y-4 mb-6">
          <h3 class="text-lg font-semibold">Behavior</h3>
          <div class="flex justify-between items-center">
            <span>Start on Login</span>
            <input type="checkbox" class="toggle toggle-primary" />
          </div>
          <div class="flex justify-between items-center">
            <span>Minimize to Tray</span>
            <input type="checkbox" class="toggle toggle-primary" checked />
          </div>
          <div class="flex justify-between items-center">
            <span>Show Notifications</span>
            <input type="checkbox" class="toggle toggle-primary" checked />
          </div>
        </div>

        <!-- Actions -->
        <div class="card-actions justify-end pt-4 border-t border-base-300">
          <button class="btn btn-circle">Cancel</button>
          <button class="btn btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

**Key Concepts:**
- Nested spacing (`space-y-4` within `space-y-6`)
- Flexbox for toggle alignment
- Card component structure
- Consistent button placement

---

### Exercise 2: Responsive Dashboard Layout

**Goal:** Create a dashboard that adapts to window size.

**Requirements:**
- Grid of stat cards (4 columns on large screens, 2 on medium, 1 on small)
- Each card shows an icon, label, and value
- Consistent spacing and colors

**Solution:**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/src/styles.css" />
  <title>Dashboard</title>
</head>
<body class="min-h-screen bg-base-100 p-8">
  <div class="max-w-7xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">Dashboard</h1>
    
    <!-- Responsive Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      
      <!-- Total Servers Card -->
      <div class="card bg-base-200 shadow-lg">
        <div class="card-body items-center text-center">
          <div class="text-primary text-4xl mb-2">🖥️</div>
          <h3 class="text-sm text-base-content/60 uppercase tracking-wide">Total Servers</h3>
          <p class="text-3xl font-bold">24</p>
        </div>
      </div>

      <!-- Active Connections Card -->
      <div class="card bg-base-200 shadow-lg">
        <div class="card-body items-center text-center">
          <div class="text-success text-4xl mb-2">✅</div>
          <h3 class="text-sm text-base-content/60 uppercase tracking-wide">Active</h3>
          <p class="text-3xl font-bold text-success">12</p>
        </div>
      </div>

      <!-- Offline Servers Card -->
      <div class="card bg-base-200 shadow-lg">
        <div class="card-body items-center text-center">
          <div class="text-error text-4xl mb-2">❌</div>
          <h3 class="text-sm text-base-content/60 uppercase tracking-wide">Offline</h3>
          <p class="text-3xl font-bold text-error">8</p>
        </div>
      </div>

      <!-- Pending Updates Card -->
      <div class="card bg-base-200 shadow-lg">
        <div class="card-body items-center text-center">
          <div class="text-warning text-4xl mb-2">⚠️</div>
          <h3 class="text-sm text-base-content/60 uppercase tracking-wide">Updates</h3>
          <p class="text-3xl font-bold text-warning">4</p>
        </div>
      </div>
      
    </div>

    <!-- Recent Activity Section -->
    <div class="mt-8">
      <h2 class="text-2xl font-bold mb-4">Recent Activity</h2>
      <div class="card bg-base-200 shadow-lg">
        <div class="card-body">
          <div class="space-y-3">
            <div class="flex justify-between items-center py-2 border-b border-base-300">
              <span>Connected to server-01.domain.com</span>
              <span class="text-sm text-base-content/60">2 minutes ago</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-base-300">
              <span>Added new host: server-15.domain.com</span>
              <span class="text-sm text-base-content/60">15 minutes ago</span>
            </div>
            <div class="flex justify-between items-center py-2">
              <span>Disconnected from server-03.domain.com</span>
              <span class="text-sm text-base-content/60">1 hour ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

**Key Concepts:**
- Responsive grid with breakpoints
- Theme color usage (`text-success`, `text-error`, etc.)
- Card components for statistics
- Nested layouts (activity list within card)

---

### Exercise 3: Custom Theme Creation

**Goal:** Create your own custom theme with a different color scheme.

**Requirements:**
- Choose a color palette (e.g., purple/green, orange/teal)
- Define all semantic colors
- Test with buttons, forms, and cards

**Solution:**

```javascript
// tailwind.config.js
import forms from "@tailwindcss/forms";
import daisyui from "daisyui";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [forms, daisyui],
  daisyui: {
    themes: [
      {
        "forest-night": {
          "primary": "#10b981",        // Emerald green
          "primary-content": "#ffffff",
          "secondary": "#059669",      // Dark green
          "accent": "#34d399",         // Light green
          "neutral": "#1f2937",        // Gray 800
          "base-100": "#0f172a",       // Slate 900
          "base-200": "#1e293b",       // Slate 800
          "base-300": "#334155",       // Slate 700
          "info": "#3b82f6",           // Blue
          "success": "#10b981",        // Green
          "warning": "#f59e0b",        // Amber
          "error": "#ef4444",          // Red
        },
      },
      {
        "sunset": {
          "primary": "#f97316",        // Orange
          "primary-content": "#ffffff",
          "secondary": "#ea580c",      // Dark orange
          "accent": "#fb923c",         // Light orange
          "neutral": "#78716c",        // Stone 500
          "base-100": "#292524",       // Stone 800
          "base-200": "#44403c",       // Stone 700
          "base-300": "#57534e",       // Stone 600
          "info": "#06b6d4",           // Cyan
          "success": "#22c55e",        // Green
          "warning": "#eab308",        // Yellow
          "error": "#dc2626",          // Red
        },
      },
    ],
    darkTheme: "forest-night",
  },
};
```

**Test Page:**

```html
<!DOCTYPE html>
<html lang="en" data-theme="forest-night">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/src/styles.css" />
  <title>Theme Test</title>
</head>
<body class="min-h-screen bg-base-100 p-8">
  <div class="max-w-4xl mx-auto space-y-8">
    
    <!-- Theme Switcher -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Theme Preview</h1>
      <select id="themeSwitcher" class="select select-bordered">
        <option value="forest-night">Forest Night</option>
        <option value="sunset">Sunset</option>
      </select>
    </div>

    <!-- Button Showcase -->
    <div class="card bg-base-200 shadow-lg">
      <div class="card-body">
        <h2 class="card-title">Buttons</h2>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-primary">Primary</button>
          <button class="btn btn-secondary">Secondary</button>
          <button class="btn btn-accent">Accent</button>
          <button class="btn btn-info">Info</button>
          <button class="btn btn-success">Success</button>
          <button class="btn btn-warning">Warning</button>
          <button class="btn btn-error">Error</button>
        </div>
      </div>
    </div>

    <!-- Form Showcase -->
    <div class="card bg-base-200 shadow-lg">
      <div class="card-body">
        <h2 class="card-title">Form Elements</h2>
        <input type="text" placeholder="Text input" class="input input-bordered w-full" />
        <textarea placeholder="Textarea" class="textarea textarea-bordered w-full"></textarea>
        <select class="select select-bordered w-full">
          <option>Option 1</option>
          <option>Option 2</option>
        </select>
      </div>
    </div>

    <!-- Alert Showcase -->
    <div class="space-y-4">
      <div class="alert alert-info">
        <span>ℹ️ This is an info alert</span>
      </div>
      <div class="alert alert-success">
        <span>✅ This is a success alert</span>
      </div>
      <div class="alert alert-warning">
        <span>⚠️ This is a warning alert</span>
      </div>
      <div class="alert alert-error">
        <span>❌ This is an error alert</span>
      </div>
    </div>

  </div>

  <script type="module">
    const themeSwitcher = document.getElementById('themeSwitcher');
    themeSwitcher.addEventListener('change', (e) => {
      document.documentElement.setAttribute('data-theme', e.target.value);
    });
  </script>
</body>
</html>
```

**Key Concepts:**
- Defining multiple custom themes
- Semantic color naming
- Testing theme with various components
- Dynamic theme switching

---

### Exercise 4: Animated Loading State

**Goal:** Create a loading overlay with animation.

**Requirements:**
- Full-screen overlay with blur effect
- Centered spinner
- Smooth fade-in/fade-out transitions

**Solution:**

```css
/* Add to styles.css */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  opacity: 0;
  animation: fadeIn 0.3s ease-out forwards;
}

.loading-overlay.hiding {
  animation: fadeOut 0.3s ease-out forwards;
}

@keyframes fadeIn {
  to { opacity: 1; }
}

@keyframes fadeOut {
  to { opacity: 0; }
}

.spinner {
  width: 64px;
  height: 64px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: #0066ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

```html
<!-- Loading Overlay Component -->
<div id="loadingOverlay" class="loading-overlay hidden">
  <div class="flex flex-col items-center gap-4">
    <div class="spinner"></div>
    <p class="text-white text-lg font-medium">Loading...</p>
  </div>
</div>
```

```typescript
// Loading overlay functions
function showLoading(message: string = 'Loading...') {
  const overlay = document.getElementById('loadingOverlay');
  const text = overlay?.querySelector('p');
  if (text) text.textContent = message;
  overlay?.classList.remove('hidden', 'hiding');
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  overlay?.classList.add('hiding');
  setTimeout(() => {
    overlay?.classList.add('hidden');
    overlay?.classList.remove('hiding');
  }, 300);
}

// Usage examples
showLoading('Connecting to server...');
setTimeout(() => hideLoading(), 2000);
```

**Key Concepts:**
- CSS animations and keyframes
- Backdrop blur effects
- Smooth transitions
- JavaScript-controlled visibility

---

### Exercise 5: Multi-Step Form

**Goal:** Create a wizard-style form with multiple steps.

**Requirements:**
- Progress indicator at the top
- Navigation between steps
- Validation before proceeding
- Summary page at the end

**Solution:**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/src/styles.css" />
  <title>Setup Wizard</title>
</head>
<body class="min-h-screen bg-base-100 p-8">
  <div class="max-w-2xl mx-auto">
    
    <!-- Progress Steps -->
    <ul class="steps steps-horizontal w-full mb-8">
      <li class="step step-primary" data-step="1">Account</li>
      <li class="step" data-step="2">Settings</li>
      <li class="step" data-step="3">Confirm</li>
    </ul>

    <!-- Form Card -->
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        
        <!-- Step 1: Account -->
        <div id="step1" class="step-content">
          <h2 class="card-title text-2xl mb-6">Create Your Account</h2>
          <div class="space-y-4">
            <div>
              <label class="label">
                <span class="label-text">Username</span>
              </label>
              <input type="text" id="username" class="input input-bordered w-full" required />
            </div>
            <div>
              <label class="label">
                <span class="label-text">Email</span>
              </label>
              <input type="email" id="email" class="input input-bordered w-full" required />
            </div>
            <div>
              <label class="label">
                <span class="label-text">Password</span>
              </label>
              <input type="password" id="password" class="input input-bordered w-full" required />
            </div>
          </div>
        </div>

        <!-- Step 2: Settings -->
        <div id="step2" class="step-content hidden">
          <h2 class="card-title text-2xl mb-6">Configure Settings</h2>
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span>Enable notifications</span>
              <input type="checkbox" class="toggle toggle-primary" id="notifications" checked />
            </div>
            <div class="flex justify-between items-center">
              <span>Dark mode</span>
              <input type="checkbox" class="toggle toggle-primary" id="darkMode" checked />
            </div>
            <div>
              <label class="label">
                <span class="label-text">Language</span>
              </label>
              <select id="language" class="select select-bordered w-full">
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Step 3: Confirm -->
        <div id="step3" class="step-content hidden">
          <h2 class="card-title text-2xl mb-6">Confirm Details</h2>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-base-300">
              <span class="text-base-content/60">Username</span>
              <span id="confirmUsername" class="font-medium"></span>
            </div>
            <div class="flex justify-between py-2 border-b border-base-300">
              <span class="text-base-content/60">Email</span>
              <span id="confirmEmail" class="font-medium"></span>
            </div>
            <div class="flex justify-between py-2 border-b border-base-300">
              <span class="text-base-content/60">Notifications</span>
              <span id="confirmNotifications" class="font-medium"></span>
            </div>
            <div class="flex justify-between py-2 border-b border-base-300">
              <span class="text-base-content/60">Language</span>
              <span id="confirmLanguage" class="font-medium"></span>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="card-actions justify-between pt-6 border-t border-base-300 mt-6">
          <button id="prevBtn" class="btn btn-circle" disabled>Previous</button>
          <button id="nextBtn" class="btn btn-primary">Next</button>
          <button id="submitBtn" class="btn btn-success hidden">Complete Setup</button>
        </div>

      </div>
    </div>
  </div>

  <script type="module">
    let currentStep = 1;
    const totalSteps = 3;

    function updateStep() {
      // Hide all steps
      document.querySelectorAll('.step-content').forEach(el => {
        el.classList.add('hidden');
      });
      
      // Show current step
      document.getElementById(`step${currentStep}`).classList.remove('hidden');
      
      // Update progress indicators
      document.querySelectorAll('.step').forEach((el, index) => {
        if (index < currentStep) {
          el.classList.add('step-primary');
        } else {
          el.classList.remove('step-primary');
        }
      });
      
      // Update buttons
      document.getElementById('prevBtn').disabled = currentStep === 1;
      document.getElementById('nextBtn').classList.toggle('hidden', currentStep === totalSteps);
      document.getElementById('submitBtn').classList.toggle('hidden', currentStep !== totalSteps);
      
      // Update summary on final step
      if (currentStep === 3) {
        document.getElementById('confirmUsername').textContent = 
          document.getElementById('username').value;
        document.getElementById('confirmEmail').textContent = 
          document.getElementById('email').value;
        document.getElementById('confirmNotifications').textContent = 
          document.getElementById('notifications').checked ? 'Enabled' : 'Disabled';
        document.getElementById('confirmLanguage').textContent = 
          document.getElementById('language').value;
      }
    }

    document.getElementById('nextBtn').addEventListener('click', () => {
      if (currentStep < totalSteps) {
        currentStep++;
        updateStep();
      }
    });

    document.getElementById('prevBtn').addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateStep();
      }
    });

    document.getElementById('submitBtn').addEventListener('click', () => {
      alert('Setup complete! ✅');
    });

    // Initialize
    updateStep();
  </script>
</body>
</html>
```

**Key Concepts:**
- DaisyUI steps component
- Progressive form disclosure
- State management with JavaScript
- Dynamic content population
- Conditional button visibility

---

## Chapter 6 Complete! 🎉

You now have a comprehensive understanding of styling Tauri applications with Tailwind CSS and DaisyUI. You've learned:

- Setting up and configuring Tailwind and PostCSS
- Using DaisyUI components effectively
- Creating custom themes and color systems
- Building responsive layouts for desktop applications
- Extending Tailwind with custom styles
- Implementing theme switching
- Analyzing QuickConnect's complete UI architecture

**Total Chapter Length:** ~40 pages  
**Exercises Completed:** 5

---

**Ready for Chapter 7? Continue to learn about Multi-Window Applications!**
