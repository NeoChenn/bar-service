import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const API_URL = import.meta.env.VITE_API_URL

const STATUS_COLOURS = {
  pending: '#d97706',    // amber
  preparing: '#2563eb',  // blue
  served: '#16a34a',     // green
  cancelled: '#6b7280',  // grey
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function StaffDashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOrders = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/orders/`)
      if (!response.ok) throw new Error('Failed to load orders')
      const data = await response.json()
      setOrders(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()

    // Subscribe to new orders via Supabase Realtime.
    // The INSERT payload only contains the orders row — it has no order_items
    // or table_number — so we re-fetch the full list via the API on each event.
    const channel = supabase
      .channel('orders-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => fetchOrders()
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchOrders])

  async function updateStatus(orderId, newStatus) {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!response.ok) throw new Error('Failed to update status')
      const updated = await response.json()
      setOrders(prev =>
        prev.map(o => (o.id === orderId ? { ...o, status: updated.status } : o))
      )
    } catch (err) {
      alert(`Could not update order: ${err.message}`)
    }
  }

  if (loading) return <div><h1>Staff Dashboard</h1><p>Loading orders...</p></div>
  if (error) return <div><h1>Staff Dashboard</h1><p style={{ color: 'red' }}>{error}</p></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Staff Dashboard</h1>
        <Link to="/history">Order history →</Link>
      </div>

      {orders.length === 0 && <p>No orders yet — they will appear here automatically.</p>}

      {orders.map(order => (
        <div
          key={order.id}
          style={{ border: '1px solid #ccc', margin: '12px 0', padding: '12px' }}
        >
          <div>
            <strong>
              {order.tables?.table_number
                ? `Table ${order.tables.table_number}`
                : 'Unknown table'}
            </strong>
            {' · '}
            {formatTime(order.created_at)}
            {' · '}
            <span style={{ color: STATUS_COLOURS[order.status] }}>
              {order.status.toUpperCase()}
            </span>
          </div>

          <ul>
            {order.order_items?.map(item => (
              <li key={item.id}>
                {item.item_name} × {item.quantity}
              </li>
            ))}
          </ul>

          <div>Total: £{Number(order.total_amount).toFixed(2)}</div>

          <div style={{ marginTop: '8px' }}>
            {order.status === 'pending' && (
              <>
                <button onClick={() => updateStatus(order.id, 'preparing')}>
                  Mark preparing
                </button>
                {' '}
                <button onClick={() => updateStatus(order.id, 'cancelled')}>
                  Cancel
                </button>
              </>
            )}
            {order.status === 'preparing' && (
              <>
                <button onClick={() => updateStatus(order.id, 'served')}>
                  Mark served
                </button>
                {' '}
                <button onClick={() => updateStatus(order.id, 'cancelled')}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
