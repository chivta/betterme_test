# Technical Requirements Document (TRD)

## 1. Business Context
* [cite_start]The system must calculate the New York state composite sales tax for drone delivery orders based on their coordinates[cite: 6, 16, 19].
* [cite_start]Open access data should be used to solve the tax calculation problem[cite: 68].

## 2. Frontend (Admin Panel) Features
* [cite_start]**Import CSV**: The interface must allow uploading a CSV file with orders, after which the system processes, calculates taxes, and saves them[cite: 23, 24, 26].
* [cite_start]**Manual Create**: Users must be able to manually create an order using latitude, longitude, and subtotal to immediately calculate and save the data[cite: 27].
* [cite_start]**Orders List**: The interface must display a table of orders with calculated taxes, featuring filters and pagination[cite: 28].
* [cite_start]**(Bonus) Authorization**: An authorization system for the admin panel is a plus, requiring test credentials to be provided if implemented[cite: 62, 63].

## 3. Backend (API) Endpoints
* [cite_start]`POST /orders/import`: Endpoint to handle CSV imports[cite: 31].
* [cite_start]`POST /orders`: Endpoint for manual order creation[cite: 32].
* [cite_start]`GET /orders`: Endpoint to retrieve the list of orders, supporting pagination and filters[cite: 33].

## 4. Data Models
**Input Data (per order):**
* [cite_start]Latitude and longitude representing a delivery point within New York State[cite: 36].
* [cite_start]Subtotal price of the wellness package without tax[cite: 37].
* [cite_start]Timestamp of the order[cite: 38].

**Output Data (per order):**
* [cite_start]`composite_tax_rate`: The final calculated tax rate[cite: 42].
* [cite_start]`tax_amount`: The calculated amount of tax[cite: 43].
* [cite_start]`total_amount`: The sum of the subtotal and the tax[cite: 44].
* [cite_start]`breakdown`: A detailed breakdown including `state_rate`, `county_rate`, `city_rate`, and `special_rates`[cite: 45, 46, 47, 48, 49].
* [cite_start]**(Bonus) Jurisdictions**: Identification of the specific jurisdictions applied to the calculation[cite: 50].

## 5. Submission and Documentation Requirements
* [cite_start]A GitHub repository containing the code and detailed instructions for local execution is mandatory[cite: 61].
* [cite_start]The README file must detail the business problem, describe the decisions made, and list any justified assumptions[cite: 64, 69].

## 6. Tech Stack Best Practices Requirements
**Golang & Fiber (Backend):**
* **Architecture**: Implement a clean architecture layout separating transport (handlers), business logic (services), and data access (repositories).
* **Configuration**: Use environment variables for all configuration settings (e.g., database credentials, API ports) utilizing packages like `godotenv` or `viper`.
* **Middleware**: Implement essential Fiber middlewares such as `Recover` (to prevent panics from crashing the app), `Logger`, and `CORS`.
* **Validation**: Use struct tags and a validation library (like `go-playground/validator`) to rigorously validate incoming JSON payloads and query parameters.
* **Database**: Utilize connection pooling and an automated migration tool (like `golang-migrate`) to safely manage database schemas.
* **Lifecycle**: Implement graceful shutdown procedures listening for OS signals (SIGINT/SIGTERM) to ensure active requests finish before the server stops.

**TypeScript & React (Frontend):**
* **Typing**: Enable `strict` mode in `tsconfig.json` and prohibit the use of `any` to ensure type safety.
* **State Management**: Use standard server-state management libraries like React Query (TanStack Query) for handling API requests, caching, and loading states instead of global stores like Redux.
* **Architecture**: Group files by feature domains (components, hooks, types) rather than pure technical types.
* **API Client**: Create a centralized Axios or Fetch instance with interceptors for consistent error handling, authentication injection, and base URL configuration.
* **Resilience**: Implement React Error Boundaries to prevent the entire application UI from unmounting due to isolated component errors.