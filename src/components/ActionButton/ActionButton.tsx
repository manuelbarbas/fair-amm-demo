import React from "react";
import { useAccount } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import styles from "./ActionButton.module.css";

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "approve";
  className?: string;
  loading?: boolean;
  loadingText?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  className = "",
  loading = false,
  loadingText = "Loading...",
}) => {
  const { isConnected } = useAccount();
  const { open } = useWeb3Modal();

  const handleClick = async () => {
    if (!isConnected) {
      // Open wallet connection modal
      open();
      return;
    }
    
    // Execute the actual action if wallet is connected
    try {
      await onClick();
    } catch (error) {
      console.error("Action button error:", error);
    }
  };

  const getButtonText = () => {
    if (loading) {
      return loadingText;
    }
    
    if (!isConnected) {
      return "Connect Wallet";
    }
    
    return children;
  };

  const getButtonClass = () => {
    const baseClass = styles.actionButton;
    const variantClass = styles[variant];
    const disabledClass = disabled ? styles.disabled : "";
    const loadingClass = loading ? styles.loading : "";
    
    return `${baseClass} ${variantClass} ${disabledClass} ${loadingClass} ${className}`.trim();
  };

  return (
    <button
      className={getButtonClass()}
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {getButtonText()}
    </button>
  );
};

export default ActionButton;
