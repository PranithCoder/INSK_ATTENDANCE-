# Employee Attendance & Point Deduction System

A premium, modern web portal designed for tracking employee attendance, computing payroll allowances, and logging point-based deductions. Supports HR administrators and employees.

---

## 🚀 Quick Start (Zero Dependencies)

Since this project runs on a browser-compiled React stack with CDNs, **you do not need to install Node.js, python, or npm!** 

To launch the project without encountering browser local file CORS restrictions:

1. Open PowerShell in this folder.
2. Run the local launcher server script:
   ```powershell
   ./run_local_server.ps1
   ```
3. A lightweight web server will spin up, and your default browser will automatically open:
   **[http://localhost:8080/](http://localhost:8080/)**

*Alternatively, you can open this folder in **VS Code** and use the **Live Server** extension to launch `index.html`.*

---

## 👥 Demo Logins (Local Storage Mode)

By default, the application runs in **Interactive Demo Mode** utilizing your browser's local storage as an active database, allowing you to test out-of-the-box. Use these credentials to sign in:

* **HR Administrator:**
  * **Email:** `admin@company.com`
  * **Password:** `admin123`
* **Staff Member (Employee):**
  * **Email:** `john.doe@company.com`
  * **Password:** `password123`

---

## ⚡ Supabase Setup (Production Database)

To connect this application to a live PostgreSQL production database on Supabase:

1. Run the database schemas in [schema.sql](file:///d:/INSK/schema.sql) in your **Supabase SQL Editor** to construct the tables, indexes, and Row-Level Security (RLS) policies.
2. In the application's login screen, click **Database Configuration Panel** (or click **Settings Panel** in the sidebar after logging in).
3. Provide your project's **Supabase URL** and **Supabase Anon Key**, then click **Connect Database**.
4. The system will reconnect, switch off Local Mode, and sync user accounts and data with your live database securely.

---

## 📂 Project Architecture

* **[index.html](file:///d:/INSK/index.html)** - Shell loading core CDNs (React 18, Babel, Tailwind CSS, Lucide Icons, Recharts, and Supabase client).
* **[app.jsx](file:///d:/INSK/app.jsx)** - Main React SPA logic (State Router, AuthScreen, Sidebar, Dashboards, Attendance logger, Deduction manager, and Payroll Report compiler).
* **[supabase-client.js](file:///d:/INSK/supabase-client.js)** - Dual-mode database connection client adapter.
* **[style.css](file:///d:/INSK/style.css)** - Design system tokens, glassmorphism templates, animations, and high-quality print styling.
* **[schema.sql](file:///d:/INSK/schema.sql)** - PostgreSQL database schemas and Row-Level Security policy definitions.
* **[run_local_server.ps1](file:///d:/INSK/run_local_server.ps1)** - Single-click PowerShell web server utility.
