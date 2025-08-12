import React, { useState } from 'react'
import Swap from './components/Swap'
import Liquidity from './components/Liquidity'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState<'swap' | 'liquidity'>('swap')

  return (
    <div className="app">
      <div className="header">
        <h1>FAIRNESS</h1>
      </div>
      
      <div className="trading-interface">
        <div className="nav">
          <button
            className={`nav-button ${activeTab === 'swap' ? 'active' : ''}`}
            onClick={() => setActiveTab('swap')}
          >
            <h3>Swap</h3>
          </button>
          <button
            className={`nav-button ${activeTab === 'liquidity' ? 'active' : ''}`}
            onClick={() => setActiveTab('liquidity')}
          >
            <h3>Add Liquidity</h3>
          </button>
        </div>
        
        {activeTab === 'swap' && <Swap />}
        {activeTab === 'liquidity' && <Liquidity />}
      </div>
    </div>
  )
}

export default App
