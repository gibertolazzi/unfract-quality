"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Check } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Rimuovi il toast dopo 4 secondi
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((msg: string) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg: string) => addToast(msg, 'error'), [addToast]);
  const info = useCallback((msg: string) => addToast(msg, 'info'), [addToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      
      {/* Container dei Toast */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => {

          return (
            <div
              key={toast.id}
              className={`
                pointer-events-auto flex items-center gap-3 p-4 rounded-xl shadow-2xl min-w-[300px] max-w-sm
                transform transition-all duration-300 ease-out animate-in slide-in-from-top-5 fade-in
                border backdrop-blur-xl
                ${toast.type === 'success' ? 'bg-[#006AFF]/10 border-[#006AFF]/20 text-white' : ''}
                ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-white' : ''}
                ${toast.type === 'info' ? 'bg-blue-500/10 border-blue-500/20 text-white' : ''}
              `}
            >
              <div className="flex-shrink-0">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#006AFF]" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              </div>
              
              <p className="flex-1 text-sm font-medium leading-tight pt-0.5">
                {toast.message}
              </p>
              
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
