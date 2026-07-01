// Phase 3: shown after Stripe redirects back post-payment.
// Polls the backend every 2s (up to 30s) to confirm the webhook wrote the order,
// since webhooks can occasionally arrive later than the redirect.
export default function ConfirmationPage() {
  return (
    <div>
      <h1>Order confirmed!</h1>
      <p>Your order is on its way.</p>
    </div>
  )
}
