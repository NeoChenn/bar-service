import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import MenuPage from './pages/MenuPage'
import CartPage from './pages/CartPage'
import ConfirmationPage from './pages/ConfirmationPage'
import StaffDashboard from './pages/StaffDashboard'
import AdminPanel from './pages/AdminPanel'

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          {/* Customer flow */}
          <Route path="/table/:tableId" element={<MenuPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />

          {/* Staff */}
          <Route path="/staff" element={<StaffDashboard />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  )
}
