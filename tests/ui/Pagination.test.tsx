import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../common/Pagination';

describe('Pagination', () => {
  it('renders pagination buttons', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onPageChange when page button is clicked', () => {
    const mockOnPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />);
    fireEvent.click(screen.getByText('2'));
    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it('disables prev button on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText('Prev')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText('Next')).toBeDisabled();
  });
});