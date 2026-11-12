import { BrowserRouter, Routes, Route } from "react-router";
import { Layout, HomePage, NotFoundPage } from "./shared/index.ts";
import { AuthProvider, RequireRole, LoginPage, RegisterPage } from "./auth/index.ts";
import { BookingPage, MyBookingsPage } from "./booking/index.ts";
import { EmployeeSlotsPage } from "./slots/index.ts";
import { RegisterHikePage, MyHikesPage, StaffHikesPage } from "./hikes/index.ts";
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
              <Route path="hikes" element={<RegisterHikePage />} />
              <Route path="my-hikes" element={<MyHikesPage />} />
            </Route>

            {/* employees and managers only */}
            <Route element={<RequireRole allow={STAFF} />}>
              <Route path="employee/slots" element={<EmployeeSlotsPage />} />
              <Route path="employee/hikes" element={<StaffHikesPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;