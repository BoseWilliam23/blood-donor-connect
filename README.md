# Blood Donor Connect 🩸

A modern, high-performance, and responsive smart blood donor management platform. This project features an Express/Node.js API backend, a React web application, and a **native Flutter mobile application** designed for Android and iOS.

---

## 🛠 Terminal Commands to Run the App

Open your terminal at the root directory of this project and use the following commands:

### 1. Install Web/API Dependencies
Installs all root, backend, and frontend packages automatically:
```bash
npm run install:all
```

### 2. Start the Backend API & Web Server
Starts the Node.js API server (on port 5000) and the React web app (on port 5173) concurrently:
```bash
npm start
```
*   **API Base URL**: `http://localhost:5000/api`
*   **Web Frontend URL**: `http://localhost:5173`

### 3. Run the Native Flutter App (Emulator or Connected Device)
Launches the native Flutter app on your running Android Emulator/Device:
```bash
npm run flutter:run
```

### 4. Open the Flutter Android Project in Android Studio
Opens the native Android portion of the Flutter project directly in Android Studio:
```bash
npm run flutter:open
```

---

## 📁 Native Flutter App Structure

The Flutter project is located in the **`mobile_flutter/`** directory. Key files include:

*   **Main Configuration**: [pubspec.yaml](file:///Users/wills/Documents/Micro%20Project/stitch_blood_donor_connect/mobile_flutter/pubspec.yaml)
*   **Entry Point & Routing**: [main.dart](file:///Users/wills/Documents/Micro%20Project/stitch_blood_donor_connect/mobile_flutter/lib/main.dart)
*   **API Client / Base URL Resolution**: [api_service.dart](file:///Users/wills/Documents/Micro%20Project/stitch_blood_donor_connect/mobile_flutter/lib/services/api_service.dart)
*   **Session State Provider**: [auth_provider.dart](file:///Users/wills/Documents/Micro%20Project/stitch_blood_donor_connect/mobile_flutter/lib/providers/auth_provider.dart)
*   **Screens Folder**: `mobile_flutter/lib/screens/`
    *   `landing_screen.dart`: Welcome dashboard and regional stats.
    *   `login_screen.dart`: Donor/admin unified credentials logging.
    *   `register_screen.dart`: 3-step registration wizard.
    *   `search_screen.dart`: Filterable donor grid and contact drawer.
    *   `emergency_screen.dart`: Active crisis boards and request broadcast creation form.
    *   `donor_dashboard.dart`: Availability toggle, matching requests alerts, and donation history log.
    *   `admin_dashboard.dart`: System KPI cards, pending request directory, and donor matching assignments.

---

## 🔑 Demo Account Credentials

Use these credentials to log in and test different system flows:

### 🧑‍💼 Donor Account
*   **Email**: `donor@example.com`
*   **Password**: `password123`
*   *Provides access to the Donor Profile dashboard, history timeline, and availability toggles.*

### 🏥 Hospital / Admin Account
*   **Email**: `admin@hospital.org`
*   **Password**: `admin123`
*   *Provides access to system metrics, active emergency broadcasts, and doctor/donor matches.*
