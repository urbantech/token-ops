import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CostTrendChart } from '../CostTrendChart';

// Refs #11

describe('CostTrendChart', () => {
  it('renders the header', () => {
    render(<CostTrendChart />);
    expect(screen.getByText('Spend Over Time')).toBeInTheDocument();
  });

  it('renders the time range selector buttons', () => {
    render(<CostTrendChart />);
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();
  });

  it('defaults to 7d range', () => {
    render(<CostTrendChart />);
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
  });

  it('switches to 30d range when clicked', async () => {
    const user = userEvent.setup();
    render(<CostTrendChart />);

    await user.click(screen.getByText('30d'));
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
  });

  it('switches to 90d range when clicked', async () => {
    const user = userEvent.setup();
    render(<CostTrendChart />);

    await user.click(screen.getByText('90d'));
    expect(screen.getByText('Last 90 Days')).toBeInTheDocument();
  });

  it('accepts a custom default range', () => {
    render(<CostTrendChart defaultRange="30d" />);
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
  });

  it('shows total spend for the period', () => {
    render(<CostTrendChart />);
    // Should contain a dollar amount
    expect(screen.getByText(/\$/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CostTrendChart className="my-chart-class" />
    );
    expect(container.firstChild).toHaveClass('my-chart-class');
  });

  it('renders the chart container', () => {
    const { container } = render(<CostTrendChart />);
    // Recharts ResponsiveContainer renders a div
    const chartWrapper = container.querySelector('.recharts-responsive-container');
    expect(chartWrapper).toBeInTheDocument();
  });
});
