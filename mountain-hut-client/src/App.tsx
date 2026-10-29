import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import BookingPage from "./pages/BookingPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
  return(
    <BrowserRouter>
      <Routes>
        <Route element={<Layout/>}>
        <Route index element={<HomePage />}/>
        <Route path="booking" element={<BookingPage />}/>
        <Route path="my-bookings" element={<MyBookingsPage />}/>
        <Route path="login" element={<LoginPage />}/>
        <Route path="*" element={<NotFoundPage />}/>
        </Route>
      </Routes>
    </BrowserRouter>

  );
}

export default App;