import React from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isBattleScreen = location.pathname === '/battle';

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className={`flex-1 ${isBattleScreen ? '' : 'p-6'} md:ml-0 ml-16`}>
          {children}
        </main>
      </div>
    </div>
  );
}