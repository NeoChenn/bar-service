import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function CartPage() {
  const { tableId, items, total, dispatch } = useCart()

  function updateQty(id, quantity) {
    if (quantity <= 0) {
      dispatch({ type: 'REMOVE_ITEM', id })
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', id, quantity })
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

      {/* Checkout button wired up in Phase 3 */}
      <button disabled title="Coming in Phase 3">Proceed to checkout</button>
    </div>
  )
}
