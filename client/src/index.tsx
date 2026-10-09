import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import RoutesComponent from './app';
import './index.css';

const MainApp = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="text-center max-w-md p-8">
              <h1 className="text-xl font-bold text-slate-900 mb-2">出错了</h1>
              <p className="text-sm text-slate-500 mb-4">{error.message}</p>
              <button
                onClick={resetErrorBoundary}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                重试
              </button>
            </div>
          </div>
        )}
      >
        <RoutesComponent />
      </ErrorBoundary>
    </BrowserRouter>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>,
);
