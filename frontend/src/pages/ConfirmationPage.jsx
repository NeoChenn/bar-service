import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'

const API_URL = import.meta.env.VITE_API_URL
const POLL_INTERVAL_MS = 2000
const MAX_ATTEMPTS = 15  // 15 × 2s = 30 seconds

export default function ConfirmationPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { dispatch } = useCart()

  const [status, setStatus] = useState('polling')  // polling | confirmed | timeout | error
  const [order, setOrder] = useState(null)
  const attemptsRef = useRef(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!sessionId) {
      setStatus('error')
      return
    }

    // Clear the cart immediately — payment was confirmed by Stripe before
    // redirecting here, so we don't need to wait for the webhook.
    dispatch({ type: 'CLEAR_CART' })

    async function poll() {
      attemptsRef.current += 1

      if (attemptsRef.current > MAX_ATTEMPTS) {
        clearInterval(intervalRef.current)
        setStatus('timeout')
        return
      }

      try {
        const response = await fetch(`${API_URL}/orders/by-session/${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          clearInterval(intervalRef.current)
          setOrder(data)
          setStatus('confirmed')
        }
        // 404 means the webhook hasn't fired yet — keep polling
      } catch {
        // Network error — keep polling, don't give up yet
      }
    }

    poll()  // Poll immediately on mount, then every POLL_INTERVAL_MS
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => clearInterval(intervalRef.current)
  }, [sessionId, dispatch])

  if (status === 'error') {
    return (
      <div>
        <h1>Something went wrong</h1>
        <p>If you completed payment, your order was received — please let staff know.</p>
      </div>
    )
  }

  if (status === 'polling') {
    return (
      <div>
        <h1>Confirming your order...</h1>
        <p>Please wait a moment.</p>
      </div>
    )
  }

  if (status === 'timeout') {
    // Payment succeeded — Stripe only redirects here after a successful charge.
    // The webhook is just delayed; the order will appear on the staff dashboard shortly.
    return (
      <div>
        <h1>Payment received!</h1>
        <p>Your order is being processed. Staff will bring it to your table shortly.</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Order confirmed!</h1>
      <p>Your order is on its way.</p>

      {order?.order_items?.map(item => (
        <div key={item.id}>
          <span>{item.item_name}</span>
          <span>× {item.quantity}</span>
          <span>£{(item.price_at_order * item.quantity).toFixed(2)}</span>
        </div>
      ))}

      <strong>Total: £{Number(order?.total_amount).toFixed(2)}</strong>
    </div>
  )
}
