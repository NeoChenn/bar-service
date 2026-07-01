import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL

const STATUS_COLOURS = {
  pending:   '#d97706',
  preparing: '#2563eb',
  served:    '#16a34a',
  cancelled: '#6b7280',
}

const STATUSES = ['', 'pending', 'preparing', 'served', 'cancelled']

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function OrderHistory() {
  const [orders, setOrders]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [startDate, setStartDate]         = useState('')
  const [endDate, setEndDate]             = useState('')
  const [status, setStatus]               = useState('')
  const [tableNumber, setTableNumber]     = useState('')
  const [appliedFilters, setAppliedFilters] = useState({})

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (appliedFilters.startDate)   params.set('start_date',   appliedFilters.startDate)
      if (appliedFilters.endDate)     params.set('end_date',     appliedFilters.endDate)
      if (appliedFilters.status)      params.set('status',       appliedFilters.status)
      if (appliedFilters.tableNumber) params.set('table_number', appliedFilters.tableNumber)
      try {
        const res = await fetch(`${API_URL}/orders/history?${params}`)
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        setOrders(await res.json())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [appliedFilters])

  function applyFilters(e) {
    e.preventDefault()
    setAppliedFilters({ startDate, endDate, status, tableNumber })
  }

  function clearFilters() {
    setStartDate('')
    setEndDate('')
    setStatus('')
    setTableNumber('')
    setAppliedFilters({})
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Order History</h1>

      <form
        onSubmit={applyFilters}
        style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        <label>
          From<br />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </label>
        <label>
          To<br />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </label>
        <label>
          Status<br />
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </label>
        <label>
          Table<br />
          <input
            type="text"
            placeholder="e.g. 4"
            value={tableNumber}
            onChange={e => setTableNumber(e.target.value)}
            style={{ width: '80px' }}
          />
        </label>
        <button type="submit">Apply</button>
        <button type="button" onClick={clearFilters}>Clear</button>
      </form>

      {loading && <p>Loading...</p>}
      {error   && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!loading && !error && orders.length === 0 && <p>No orders found.</p>}

      {orders.map(order => (
        <div
          key={order.id}
          style={{ border: '1px solid #ccc', borderRadius: '6px', marginBottom: '12px', padding: '16px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <strong>
              {order.tables?.table_number ? `Table ${order.tables.table_number}` : 'Unknown table'}
            </strong>
            <span>
              <span style={{ color: STATUS_COLOURS[order.status], marginRight: '12px' }}>
                {order.status.toUpperCase()}
              </span>
              {formatDateTime(order.created_at)}
            </span>
          </div>

          <ul style={{ margin: '0 0 8px', paddingLeft: '20px' }}>
            {order.order_items?.map(item => (
              <li key={item.id}>
                {item.item_name} × {item.quantity}
                {' — '}£{(item.price_at_order * item.quantity).toFixed(2)}
              </li>
            ))}
          </ul>

          <div style={{ textAlign: 'right' }}>
            <strong>Total: £{Number(order.total_amount).toFixed(2)}</strong>
          </div>
        </div>
      ))}
    </div>
  )
}
