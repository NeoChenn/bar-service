import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL

export default function ProtectedRoute({ role, children }) {
  const [authenticated, setAuthenticated] = useState(
    sessionStorage.getItem('bar_role') === role
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, role }),
      })

      if (!response.ok) {
        setError('Incorrect password')
        setPassword('')
        return
      }

      sessionStorage.setItem('bar_role', role)
      setAuthenticated(true)
    } catch {
      setError('Could not reach server — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    sessionStorage.removeItem('bar_role')
    setAuthenticated(false)
    setPassword('')
  }

  if (!authenticated) {
    return (
      <div>
        <h1>{role === 'staff' ? 'Staff access' : 'Admin access'}</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
          />
          {' '}
          <button type="submit" disabled={loading}>
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    )
  }

  return (
    <>
      <div style={{ textAlign: 'right', padding: '8px' }}>
        <button onClick={signOut}>Sign out</button>
      </div>
      {children}
    </>
  )
}
