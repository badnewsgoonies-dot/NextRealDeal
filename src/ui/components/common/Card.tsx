import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps): React.ReactElement {
  return (
    <div className={`bg-surface border border-border-color rounded-xl shadow-card p-6 ${className}`}>
      {children}
    </div>
  );
}