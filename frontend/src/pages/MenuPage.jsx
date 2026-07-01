import { useParams } from 'react-router-dom'

// Phase 2: fetch menu items from Supabase, display by category, cart state
export default function MenuPage() {
  const { tableId } = useParams()

  return (
    <div>
      <h1>Menu — Table {tableId}</h1>
      <p>Menu items will appear here.</p>
    </div>
  )
}
