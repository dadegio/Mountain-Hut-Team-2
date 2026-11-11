import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./components/layout/Layout";
import RequireRole from "./components/layout/RequireRole";
import HomePage from "./pages/HomePage";
import BookingPage from "./pages/BookingPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import EmployeeSlotsPage from "./pages/EmployeeSlotsPage";
import NotFoundPage from "./pages/NotFoundPage";
import AuthProvider from "./context/AuthProvider";

const STAFF = ["EMPLOYEE", "MANAGER"];

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            {/* guests can browse availability, hikers can book, staff can't */}
            <Route element={<RequireRole allow={["HIKER"]} guestAllowed />}>
              <Route path="booking" element={<BookingPage />} />
            </Route>

            {/* hikers only */}
            <Route element={<RequireRole allow={["HIKER"]} />}>
              <Route path="my-bookings" element={<MyBookingsPage />} />
            </Route>

            {/* employees and managers only */}
            <Route element={<RequireRole allow={STAFF} />}>
              <Route path="employee/slots" element={<EmployeeSlotsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;