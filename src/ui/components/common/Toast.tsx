import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

function ToastItem({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: 'bg-success',
    error: 'bg-danger',
    info: 'bg-primary',
  }[type];

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-md shadow-card flex items-center justify-between`}>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-4 text-white hover:opacity-75"
        aria-label="Close toast"
      >
        ✕
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<ToastProps & { id: string }>;
  removeToast: (id: string) => void;
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return createPortal(
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>,
    document.body
  );
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = (++toastId).toString();
    setToasts(prev => [...prev, { id, message, type, onClose: () => {} }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return {
    toasts,
    addToast,
    removeToast,
    ToastContainer: () => <ToastContainer toasts={toasts} removeToast={removeToast} />,
  };
}