import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Layouts
import RootLayout from '../layouts/RootLayout';
import AppSectionLayout from '../layouts/AppSectionLayout';

// --- MODIFICATION 1: Lazy load feature components directly ---
// We no longer import from the 'pages' folder.
const Trade = lazy(() => import('../features/trade/Trade').then(module => ({ default: module.Trade })));
const PoolCreate = lazy(() => import('../features/pool/components/PoolCreate').then(module => ({ default: module.PoolCreate })));

// A simple loading spinner component (can be moved to components/ui later)
const LoadingSpinner = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '200px',
    color: 'var(--text-secondary)',
    fontSize: '16px'
  }}>
    Loading...
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        // --- MODIFICATION 2: Simplify the index route ---
        // The index route now directly renders the <Trade /> feature.
        // The custom LazyWrapper is removed in favor of a direct <Suspense> component.
        index: true,
        element: (
            <Suspense fallback={<LoadingSpinner />}>
              <Trade />
            </Suspense>
        ),
      },
      {
        // --- MODIFICATION 3: Redirect '/swap' to '/' ---
        // This removes the duplicate route and creates a single source of truth.
        path: 'swap',
        element: <Navigate to="/" replace />,
      },
      {
        path: 'pool/create',
        element: (
            <Suspense fallback={<LoadingSpinner />}>
              <PoolCreate />
            </Suspense>
        ),
      },
    ],
  },
]);

export default router;
