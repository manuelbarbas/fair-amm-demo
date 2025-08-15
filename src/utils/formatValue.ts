export const formatValue = (value: number): string => {
  if (value === 0) return "0";
  
  const absValue = Math.abs(value);
  
  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString('en-US', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 1 
    })}B`;
  } else if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('en-US', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 1 
    })}M`;
  } else if (absValue >= 1_000) {
    return `${(value / 1_000).toLocaleString('en-US', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 1 
    })}K`;
  } else if (absValue >= 1) {
    return `${value.toLocaleString('en-US', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 1 
    })}`;
  } else {
    return `${value.toFixed(2)}`;
  }
};