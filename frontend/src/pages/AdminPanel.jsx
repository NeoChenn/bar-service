import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const API_URL = import.meta.env.VITE_API_URL

const EMPTY_FORM = { name: '', description: '', price: '', category: '', available: true }

export default function AdminPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)  // null = adding, uuid = editing
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function fetchItems() {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .order('category')
      .order('name')
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  function startEdit(item) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description || '',
      price: String(item.price),
      category: item.category,
      available: item.available,
    })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      category: form.category.trim(),
      available: form.available,
    }

    try {
      const url = editingId ? `${API_URL}/menu/${editingId}` : `${API_URL}/menu/`
      const method = editingId ? 'PATCH' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const d = await response.json()
        throw new Error(d.detail || 'Save failed')
      }
      await fetchItems()
      cancelEdit()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleAvailable(item) {
    await fetch(`${API_URL}/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: !item.available }),
    })
    await fetchItems()
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    await fetch(`${API_URL}/menu/${item.id}`, { method: 'DELETE' })
    await fetchItems()
  }

  // Group items by category for display
  const byCategory = items.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div>
      <h1>Admin Panel</h1>

      {/* Add / edit form */}
      <h2>{editingId ? 'Edit item' : 'Add item'}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <input
            placeholder="Name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <input
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <input
            placeholder="Price *"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            required
          />
        </div>
        <div>
          <input
            placeholder="Category *"
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            required
          />
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={form.available}
              onChange={e => setForm(f => ({ ...f, available: e.target.checked }))}
            />
            {' '}Available
          </label>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add item'}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit} style={{ marginLeft: '8px' }}>
            Cancel
          </button>
        )}
      </form>

      {/* Menu item list */}
      <h2>Menu</h2>
      {loading && <p>Loading...</p>}

      {Object.entries(byCategory).map(([category, categoryItems]) => (
        <div key={category}>
          <h3>{category}</h3>
          {categoryItems.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '6px 0',
                opacity: item.available ? 1 : 0.5,
              }}
            >
              <span style={{ flex: 1 }}>
                {item.name} — £{Number(item.price).toFixed(2)}
                {!item.available && ' (unavailable)'}
              </span>
              <button onClick={() => toggleAvailable(item)}>
                {item.available ? 'Mark unavailable' : 'Mark available'}
              </button>
              <button onClick={() => startEdit(item)}>Edit</button>
              <button onClick={() => handleDelete(item)}>Delete</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
