"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface DialogPromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

interface DialogContextType {
  confirm: (options: DialogOptions) => Promise<boolean>;
  alert: (options: Omit<DialogOptions, 'cancelText'>) => Promise<void>;
  prompt: (options: DialogPromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const [resolveFn, setResolveFn] = useState<((value: any) => void) | null>(null);
  const [isAlertMode, setIsAlertMode] = useState(false);

  // For prompt
  const [isPromptMode, setIsPromptMode] = useState(false);
  const [promptOptions, setPromptOptions] = useState<DialogPromptOptions | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const confirm = useCallback((opts: DialogOptions) => {
    setOptions({
      confirmText: 'Conferma',
      cancelText: 'Annulla',
      isDestructive: false,
      ...opts
    });
    setIsAlertMode(false);
    setIsPromptMode(false);
    setIsOpen(true);
    
    return new Promise<boolean>((resolve) => {
      setResolveFn(() => resolve);
    });
  }, []);

  const alert = useCallback((opts: Omit<DialogOptions, 'cancelText'>) => {
    setOptions({
      confirmText: 'Ok',
      isDestructive: false,
      ...opts
    });
    setIsAlertMode(true);
    setIsPromptMode(false);
    setIsOpen(true);
    
    return new Promise<void>((resolve) => {
      setResolveFn(() => () => resolve());
    });
  }, []);

  const prompt = useCallback((opts: DialogPromptOptions) => {
    setPromptOptions({
      confirmText: 'Conferma',
      cancelText: 'Annulla',
      ...opts
    });
    setPromptValue('');
    setIsPromptMode(true);
    setIsAlertMode(false);
    setIsOpen(true);

    return new Promise<string | null>((resolve) => {
      setResolveFn(() => resolve);
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolveFn) {
      if (isPromptMode) {
        resolveFn(promptValue);
      } else {
        resolveFn(true);
      }
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolveFn) {
      if (isPromptMode) {
        resolveFn(null);
      } else {
        resolveFn(false);
      }
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, alert, prompt }}>
      {children}
      
      {isOpen && (options || promptOptions) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleCancel}
          />
          
          <div className="relative bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex gap-4">
              {options?.isDestructive && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
              )}
              <div className="flex-1 w-full">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {isPromptMode ? promptOptions?.title : options?.title}
                </h3>
                
                {(isPromptMode ? promptOptions?.message : options?.message) && (
                  <p className="text-white/70 text-sm leading-relaxed mb-6">
                    {isPromptMode ? promptOptions?.message : options?.message}
                  </p>
                )}

                {isPromptMode && (
                  <input
                    type="text"
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    placeholder={promptOptions?.placeholder || ''}
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white mb-6 focus:outline-none focus:border-[#006AFF]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirm();
                      if (e.key === 'Escape') handleCancel();
                    }}
                  />
                )}
                
                <div className="flex items-center justify-end gap-3">
                  {!isAlertMode && (
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-sm font-medium text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      {isPromptMode ? promptOptions?.cancelText : options?.cancelText}
                    </button>
                  )}
                  
                  <button
                    onClick={handleConfirm}
                    disabled={isPromptMode && !promptValue.trim()}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-lg disabled:opacity-50 ${
                      options?.isDestructive 
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' 
                        : 'bg-[#00FF88] hover:bg-[#00e67a] text-black shadow-[#00FF88]/20'
                    }`}
                  >
                    {isPromptMode ? promptOptions?.confirmText : options?.confirmText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
