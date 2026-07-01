import { useEffect, useState } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const API_URL = import.meta.env.VITE_API_URL

const PERIODS = [
  { label: 'Last 7 days',   days: 7 },
  { label: 'Last 30 days',  days: 30 },
  { label: 'Last 3 months', days: 90 },
  { label: 'Last year',     days: 365 },
  { label: 'All time',      days: 0 },
]

const REVENUE_VIEWS = {
  day:   { label: 'Daily',   dataKey: 'revenue_by_day',   xKey: 'date' },
  week:  { label: 'Weekly',  dataKey: 'revenue_by_week',  xKey: 'week' },
  month: { label: 'Monthly', dataKey: 'revenue_by_month', xKey: 'month' },
}

export default function AnalyticsDashboard() {
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [days, setDays]               = useState(30)
  const [revenueView, setRevenueView] = useState('day')

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/analytics/summary?days=${days}`)
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        setData(await res.json())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [days])

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h1>Analytics</h1>

      <div style={{ marginBottom: '24px' }}>
        {PERIODS.map(p => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            style={{ marginRight: '8px', fontWeight: days === p.days ? 'bold' : 'normal' }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <p>Loading...</p>}
      {error   && <p style={{ color: 'red' }}>Error: {error}</p>}

      {data && (
        <>
          <section style={{ marginBottom: '40px' }}>
            <h2>Average Order Value</h2>
            <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0 }}>
              £{Number(data.average_order_value).toFixed(2)}
            </p>
          </section>

          <section style={{ marginBottom: '40px' }}>
            <h2>Revenue</h2>
            <div style={{ marginBottom: '12px' }}>
              {Object.entries(REVENUE_VIEWS).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => setRevenueView(key)}
                  style={{ marginRight: '8px', fontWeight: revenueView === key ? 'bold' : 'normal' }}
                >
                  {label}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data[REVENUE_VIEWS[revenueView].dataKey]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={REVENUE_VIEWS[revenueView].xKey} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `£${v}`} width={70} />
                <Tooltip formatter={v => [`£${Number(v).toFixed(2)}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section style={{ marginBottom: '40px' }}>
            <h2>Busiest Hours</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.busiest_hours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="hour"
                  tickFormatter={h => `${String(h).padStart(2, '0')}:00`}
                  tick={{ fontSize: 11 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={h => `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`}
                  formatter={v => [v, 'Orders']}
                />
                <Bar dataKey="order_count" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section>
            <h2>Top Items by Quantity</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.top_items_by_quantity} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="item_name" width={160} tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => [v, 'Units sold']} />
                <Bar dataKey="total_quantity" fill="#16a34a" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <h2 style={{ marginTop: '32px' }}>Top Items by Revenue</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.top_items_by_revenue} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => `£${v}`} />
                <YAxis type="category" dataKey="item_name" width={160} tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => [`£${Number(v).toFixed(2)}`, 'Revenue']} />
                <Bar dataKey="total_revenue" fill="#d97706" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  )
}
