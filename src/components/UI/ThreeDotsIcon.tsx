import React from "react";

export const ThreeDotsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props
) => {
  return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="19" cy="12" r="2" fill="currentColor" />
          <circle cx="5" cy="12" r="2" fill="currentColor" />
        </svg>
  );
};
