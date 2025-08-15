import React from 'react';

/**
 * A reusable arrow icon component that points up by default.
 * It can be rotated via CSS transforms passed in the className prop.
 */
export const ArrowUp: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg 
      width="12" 
      height="12" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      {...props} // Pass down all props, including className
    >
      <path d="M7 15L12 10L17 15H7Z" fill="currentColor"/>
    </svg>
  );
};
