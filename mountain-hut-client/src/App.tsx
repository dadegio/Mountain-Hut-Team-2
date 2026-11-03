import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import BookingPage from "./pages/BookingPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import LoginPage from "./pages/LoginPage";
import EmployeeSlotsPage from "./pages/EmployeeSlotsPage";
import NotFoundPage from "./pages/NotFoundPage";
import AuthProvider from './context/AuthProvider'

function App() {
  return(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout/>}>
          <Route index element={<HomePage />}/>
          <Route path="booking" element={<BookingPage />}/>
          <Route path="my-bookings" element={<MyBookingsPage />}/>
          <Route path="login" element={<LoginPage />}/>
          <Route path="employee/slots" element={<EmployeeSlotsPage />}/>
          <Route path="*" element={<NotFoundPage />}/>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>

  );
}

export default App;