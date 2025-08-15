import React from "react";

export const SmallWallet: React.FC<React.SVGProps<SVGSVGElement>> = (
  props
) => {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M21 8.5H3C2.45 8.5 2 8.95 2 9.5V17.5C2 18.88 3.12 20 4.5 20H19.5C20.88 20 22 18.88 22 17.5V9.5C22 8.95 21.55 8.5 21 8.5Z"
        fill="currentColor"
      />
      <path
        d="M4.5 4C3.12 4 2 5.12 2 6.5V7.5H22V6.5C22 5.12 20.88 4 19.5 4H4.5Z"
        fill="currentColor"
      />
      <circle cx="18" cy="14" r="1.5" fill="#fff" />
    </svg>
  );
};
