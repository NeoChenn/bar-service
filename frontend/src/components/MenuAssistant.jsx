import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL

export default function MenuAssistant() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input.trim() }
    const updatedHistory = [...messages, userMessage]

    setMessages(updatedHistory)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/assistant/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_history: updatedHistory }),
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    // bottom: 80px clears the sticky "View order" cart bar (position: sticky, bottom: 0)
    // that appears at the bottom of the menu page when the cart is non-empty
    <div style={{ position: 'fixed', bottom: '80px', right: '24px', zIndex: 50 }}>

      {open && (
        <div style={{
          position: 'absolute', bottom: '52px', right: 0,
          width: '320px', height: '420px',
          border: '1px solid #ccc', borderRadius: '12px',
          background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
            Menu Assistant
          </div>

          <div style={{ padding: '8px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: '12px' }}>
            ⚠️ Always confirm allergen information with staff before ordering.
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.length === 0 && (
              <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                Ask me about the menu — I can help with recommendations, dietary requirements, and more.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: m.role === 'user' ? '#2563eb' : '#f3f4f6',
                color: m.role === 'user' ? '#fff' : '#111',
                fontSize: '14px',
              }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: '#6b7280', fontSize: '14px' }}>
                Thinking...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} style={{ display: 'flex', borderTop: '1px solid #eee', padding: '8px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about the menu..."
              disabled={loading}
              style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{ marginLeft: '8px', padding: '8px 12px', borderRadius: '6px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: '#2563eb', color: '#fff', border: 'none',
          fontSize: '20px', cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
        aria-label={open ? 'Close menu assistant' : 'Open menu assistant'}
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  )
}
