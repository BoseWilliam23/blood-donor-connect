# Blood Donor Connect 🩸

A modern, high-performance, and responsive smart blood donor management web application built using **React**, **Vite**, **Tailwind CSS**, and **Supabase** (PostgreSQL & Auth).

---

## 🚀 Getting Started

Follow these simple commands to run the application locally:

### 1. Install Dependencies
Installs all required npm packages:
```bash
npm install
```

### 2. Configure Environment
1. Copy the environment configuration template file (if not already done):
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and make sure your Supabase Project URL and Anon Public Key are filled:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
   ```

### 3. Run the Development Server
Launches the React web client application:
```bash
npm run dev
```
*The website will open on **http://localhost:5173**.*

---

## 📂 Project Structure

* **`src/`**: The core source code containing the React client application.
  * `supabaseClient.js`: Initializes and exports the Supabase client connection.
  * `App.jsx`: Main single-page application, routing, view states, forms, and dashboard interfaces.
* **`public/`**: Static assets like logos and icons.
* **`schema.sql`**: Contains the SQL scripts (tables, views, triggers) to run in the Supabase SQL editor.
* **`.env`**: Local environment configuration file containing Supabase credentials.

---

## 🔑 Demo Account Credentials

Use these credentials to log in and test different system flows (after setting up Auth in Supabase):

### 🧑‍💼 Donor Account
* **Email**: `donor@example.com`
* **Password**: `password123`
* *Provides access to the Donor Profile dashboard, history timeline, and availability toggles.*

### 🏥 Hospital / Admin Account
* **Email**: `admin@hospital.org`
* **Password**: `admin123`
* *Provides access to system metrics, active emergency broadcasts, and doctor/donor matches.*
