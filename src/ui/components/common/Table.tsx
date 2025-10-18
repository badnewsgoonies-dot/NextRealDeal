import React from 'react';

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  sortBy?: keyof T;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: keyof T) => void;
  className?: string;
}

export function Table<T extends Record<string, unknown>>({
  data,
  columns,
  sortBy,
  sortOrder,
  onSort,
  className = '',
}: TableProps<T>): React.ReactElement {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border-color">
            {columns.map(column => (
              <th
                key={column.key as string}
                className={`text-left py-3 px-4 text-sm font-medium text-text-secondary ${
                  column.sortable ? 'cursor-pointer hover:text-text-primary' : ''
                }`}
                onClick={() => column.sortable && onSort?.(column.key)}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.label}</span>
                  {column.sortable && sortBy === column.key && (
                    <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} className="border-b border-border-color hover:bg-surface">
              {columns.map(column => (
                <td key={column.key as string} className="py-3 px-4 text-sm">
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}