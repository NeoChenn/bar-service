import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'

const API_URL = import.meta.env.VITE_API_URL

export default function CartPage() {
  const { tableId, items, total, dispatch } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function updateQty(id, quantity) {
    if (quantity <= 0) {
      dispatch({ type: 'REMOVE_ITEM', id })
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', id, quantity })
    }
  }

  async function handleCheckout() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          // Send only IDs and quantities — prices are fetched server-side
          items: items.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Checkout failed. Please try again.')
      }

      const { session_url } = await response.json()
      // Hard redirect to Stripe's hosted checkout page — not React Router,
      // since we're leaving the app entirely.
      window.location.href = session_url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div>
        <h1>Your order</h1>
        <p>Your cart is empty.</p>
        {tableId && <Link to={`/table/${tableId}`}>← Back to menu</Link>}
      </div>
    )
  }

  return (
    <div>
      <h1>Your order</h1>
      {tableId && <Link to={`/table/${tableId}`}>← Back to menu</Link>}

      {items.map(item => (
        <div key={item.id}>
          <span>{item.name}</span>
          <span>£{item.price.toFixed(2)} each</span>
          <button onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
          <span>{item.quantity}</span>
          <button onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
          <button onClick={() => dispatch({ type: 'REMOVE_ITEM', id: item.id })}>×</button>
          <span>£{(item.price * item.quantity).toFixed(2)}</span>
        </div>
      ))}

      <div>
        <strong>Total: £{total.toFixed(2)}</strong>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={handleCheckout} disabled={loading}>
        {loading ? 'Processing...' : 'Proceed to checkout'}
      </button>
    </div>
  )
}
