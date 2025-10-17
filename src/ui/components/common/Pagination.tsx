import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 text-sm border border-border-color rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface transition-colors"
      >
        Prev
      </button>
      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-1 text-sm border rounded-md transition-colors ${
            page === currentPage
              ? 'bg-primary text-white border-primary'
              : 'border-border-color hover:bg-surface'
          }`}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 text-sm border border-border-color rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface transition-colors"
      >
        Next
      </button>
    </div>
  );
}