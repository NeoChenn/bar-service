import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useCart } from '../context/CartContext'
import MenuAssistant from '../components/MenuAssistant'

export default function MenuPage() {
  const { tableId } = useParams()
  const { items, dispatch } = useCart()
  const [table, setTable] = useState(null)
  const [menuByCategory, setMenuByCategory] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      // Validate the table and fetch the menu in parallel
      const [tableResult, menuResult] = await Promise.all([
        supabase.from('tables').select('id, table_number').eq('id', tableId).single(),
        supabase.from('menu_items').select('*').eq('available', true).order('name'),
      ])

      if (tableResult.error || !tableResult.data) {
        setError('invalid_table')
        setLoading(false)
        return
      }

      if (menuResult.error) {
        setError('menu_failed')
        setLoading(false)
        return
      }

      setTable(tableResult.data)
      // Store tableId in cart state so CartPage can link back here
      dispatch({ type: 'SET_TABLE', tableId })

      // Group items by category client-side
      const grouped = menuResult.data.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push(item)
        return acc
      }, {})
      setMenuByCategory(grouped)
      setLoading(false)
    }

    load()
  }, [tableId, dispatch])

  function getQty(itemId) {
    return items.find(i => i.id === itemId)?.quantity ?? 0
  }

  function addItem(item) {
    dispatch({ type: 'ADD_ITEM', item: { id: item.id, name: item.name, price: item.price } })
  }

  function updateQty(id, quantity) {
    if (quantity <= 0) {
      dispatch({ type: 'REMOVE_ITEM', id })
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', id, quantity })
    }
  }

  if (loading) return <p>Loading menu...</p>
  if (error === 'invalid_table') return <p>Table not found. Please scan the QR code again.</p>
  if (error) return <p>Failed to load menu. Please try again.</p>

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const categories = Object.keys(menuByCategory).sort()

  return (
    <div>
      <h1>Table {table.table_number}</h1>

      {categories.length === 0 && <p>No items available right now.</p>}

      {categories.map(category => (
        <section key={category}>
          <h2>{category}</h2>
          {menuByCategory[category].map(item => {
            const qty = getQty(item.id)
            return (
              <div key={item.id}>
                <strong>{item.name}</strong>
                {item.description && <p>{item.description}</p>}
                <span>£{item.price.toFixed(2)}</span>

                {qty === 0 ? (
                  <button onClick={() => addItem(item)}>Add</button>
                ) : (
                  <span>
                    <button onClick={() => updateQty(item.id, qty - 1)}>−</button>
                    <span>{qty}</span>
                    <button onClick={() => updateQty(item.id, qty + 1)}>+</button>
                  </span>
                )}
              </div>
            )
          })}
        </section>
      ))}

      {totalItems > 0 && (
        <div style={{ position: 'sticky', bottom: 0, background: 'white', padding: '1rem' }}>
          <Link to="/cart">
            View order ({totalItems} {totalItems === 1 ? 'item' : 'items'}) →
          </Link>
        </div>
      )}

      <MenuAssistant />
    </div>
  )
}
