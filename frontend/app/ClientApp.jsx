'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('../src/App.jsx'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: '#5a6b7b',
        fontSize: '1rem',
      }}
    >
      Loading UK CliffWatch…
    </div>
  ),
});

export default function ClientApp() {
  return <App />;
}
