import React, { createContext, useContext, type ReactNode } from 'react';
import type { BatchProgressData } from '../components/BatchProgressBar';

interface BatchProgressContextValue {
  progress: BatchProgressData | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const BatchProgressContext = createContext<BatchProgressContextValue | undefined>(undefined);

interface BatchProgressProviderProps extends BatchProgressContextValue {
  children: ReactNode;
}

export const BatchProgressProvider: React.FC<BatchProgressProviderProps> = ({
  progress,
  loading,
  refresh,
  children,
}) => (
  <BatchProgressContext.Provider value={{ progress, loading, refresh }}>
    {children}
  </BatchProgressContext.Provider>
);

export const useBatchProgress = (): BatchProgressContextValue => {
  const context = useContext(BatchProgressContext);
  if (!context) {
    throw new Error('useBatchProgress must be used within BatchProgressProvider');
  }
  return context;
};
