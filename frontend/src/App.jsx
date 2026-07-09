import { useState } from 'react'
import './App.css'
import { ProductList } from './components/ProductList'
import { BatchForm } from './components/BatchForm'
import { BatchList } from './components/BatchList'

function App() {
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [refreshBatches, setRefreshBatches] = useState(0)

  const handleBatchGenerated = () => {
    setRefreshBatches(prev => prev + 1)
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>EMR Handtag Generator</h1>
          <p>Generador de Códigos y Etiquetas para Productos EMR</p>
        </div>
      </header>

      <main className="app-main">
        <div className="layout-grid">
          {/* Sidebar: Productos */}
          <aside className="sidebar">
            <ProductList 
              onProductSelect={setSelectedProductId}
              selectedProductId={selectedProductId}
            />
          </aside>

          {/* Main Content: Generación y Lotes */}
          <section className="main-content">
            <BatchForm 
              productId={selectedProductId}
              onBatchGenerated={handleBatchGenerated}
            />
            
            <BatchList refreshTrigger={refreshBatches} />
          </section>
        </div>
      </main>

      <footer className="app-footer">
        <p>Backend: http://localhost:4000 | Frontend: http://localhost:5173</p>
      </footer>
    </div>
  )
}

export default App
