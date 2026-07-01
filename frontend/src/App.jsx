import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import MenuPage from './pages/MenuPage'
import CartPage from './pages/CartPage'
import ConfirmationPage from './pages/ConfirmationPage'
import StaffDashboard from './pages/StaffDashboard'
import AdminPanel from './pages/AdminPanel'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          {/* Customer flow */}
          <Route path="/table/:tableId" element={<MenuPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />

          {/* Staff — password protected, session cleared on tab close */}
          <Route path="/staff" element={
            <ProtectedRoute role="staff"><StaffDashboard /></ProtectedRoute>
          } />

          {/* Admin — separate password from staff */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin"><AdminPanel /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  )
}
