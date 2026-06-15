import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpendByCategory } from '../SpendByCategory';
import { mockCategorySpend, type CategorySpend } from '@/lib/mock-data';

// Refs #11

describe('SpendByCategory', () => {
  it('renders the header', () => {
    render(<SpendByCategory />);
    expect(screen.getByText('Spend by Category')).toBeInTheDocument();
  });

  it('renders legend items for each category', () => {
    render(<SpendByCategory />);
    expect(screen.getByText('Updating Specs')).toBeInTheDocument();
    expect(screen.getByText('Brainstorming')).toBeInTheDocument();
    expect(screen.getByText('Updating Code')).toBeInTheDocument();
    expect(screen.getByText('Fixing Issues')).toBeInTheDocument();
    expect(screen.getByText('Batch Commands')).toBeInTheDocument();
  });

  it('renders cost values for each category', () => {
    render(<SpendByCategory />);
    for (const cat of mockCategorySpend) {
      // Each category cost should be formatted as currency
      const costTexts = screen.getAllByText(new RegExp(`\\$${cat.value.toFixed(2)}`));
      expect(costTexts.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('calls onSegmentClick when a legend item is clicked', async () => {
    const user = userEvent.setup();
    const onSegmentClick = vi.fn();
    render(<SpendByCategory onSegmentClick={onSegmentClick} />);

    const legendButton = screen.getByRole('button', { name: /Updating Code/i });
    await user.click(legendButton);

    expect(onSegmentClick).toHaveBeenCalledTimes(1);
    expect(onSegmentClick).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Updating Code' })
    );
  });

  it('shows drill-down panel when a category is selected', async () => {
    const user = userEvent.setup();
    render(<SpendByCategory />);

    const legendButton = screen.getByRole('button', { name: /Fixing Issues/i });
    await user.click(legendButton);

    expect(screen.getByText(/Fixing Issues — Details/)).toBeInTheDocument();
  });

  it('hides drill-down panel when the same category is clicked again', async () => {
    const user = userEvent.setup();
    render(<SpendByCategory />);

    const legendButton = screen.getByRole('button', { name: /Fixing Issues/i });
    await user.click(legendButton);
    expect(screen.getByText(/Fixing Issues — Details/)).toBeInTheDocument();

    await user.click(legendButton);
    expect(screen.queryByText(/Fixing Issues — Details/)).not.toBeInTheDocument();
  });

  it('accepts custom data via props', () => {
    const customData: CategorySpend[] = [
      {
        name: 'custom',
        label: 'Custom Category',
        value: 42.00,
        tokens: 500_000,
        count: 100,
        color: '#FF0000',
        fill: '#FF0000',
      },
    ];
    render(<SpendByCategory data={customData} />);
    expect(screen.getByText('Custom Category')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <SpendByCategory className="test-class" />
    );
    expect(container.firstChild).toHaveClass('test-class');
  });

  it('shows hint text about clicking segments', () => {
    render(<SpendByCategory />);
    expect(screen.getByText(/Click a segment to drill down/)).toBeInTheDocument();
  });

  it('shows percentage for each category in legend', () => {
    render(<SpendByCategory />);
    // All categories should have a percentage displayed
    const total = mockCategorySpend.reduce((s, d) => s + d.value, 0);
    for (const cat of mockCategorySpend) {
      const pct = ((cat.value / total) * 100).toFixed(0);
      expect(screen.getByText(`${pct}%`)).toBeInTheDocument();
    }
  });
});
