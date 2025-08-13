import React, { useState } from "react";
import Swap from "./components/swap/Swap";
import WalletButton from "./components/wallet/WalletButton";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState<"swap" | "liquidity">("swap");

  return (
    <div className="app">
      <div className="top-header">
        <div className="header">
          <h1>FAIRNESS</h1>
        </div>
        <WalletButton />
      </div>

      <div className="trading-interface">
        <div className="nav">
          <button
            className={`nav-button ${activeTab === "swap" ? "active" : ""}`}
            onClick={() => setActiveTab("swap")}
          >
            <h3>Swap</h3>
          </button>
          <button className={`nav-button`}>
            <h3>Bridge</h3>
          </button>
          <button className={`nav-button`}>
            <h3>Buy</h3>
          </button>
          <button className={`nav-button`}>
            <h3>Sell</h3>
          </button>
        </div>

        {activeTab === "swap" && <Swap />}
      </div>
    </div>
  );
}

export default App;
