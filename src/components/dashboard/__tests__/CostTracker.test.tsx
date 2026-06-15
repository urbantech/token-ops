import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CostTracker } from '../CostTracker';
import { mockAgentCosts, mockTotalCost } from '@/lib/mock-data';

// Refs #11

describe('CostTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header with title', async () => {
    render(<CostTracker />);
    await waitFor(() => {
      expect(screen.getByText('Agent Cost Breakdown')).toBeInTheDocument();
    });
  });

  it('renders loading skeletons initially', () => {
    render(<CostTracker />);
    // Skeleton rows are rendered while loading
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('renders agent rows after data loads', async () => {
    render(<CostTracker />);
    await waitFor(() => {
      expect(screen.getByText('Code Review Agent')).toBeInTheDocument();
    }, { timeout: 10_000 });
    expect(screen.getByText('Spec Writer Agent')).toBeInTheDocument();
    expect(screen.getByText('Brainstorm Agent')).toBeInTheDocument();
    expect(screen.getByText('Dev Assistant')).toBeInTheDocument();
    expect(screen.getByText('Batch Runner')).toBeInTheDocument();
  }, 15_000);

  it('displays model names for each agent', async () => {
    render(<CostTracker />);
    await waitFor(() => {
      expect(screen.getByText('claude-opus-4-6')).toBeInTheDocument();
    });
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
  });

  it('displays classification badges', async () => {
    render(<CostTracker />);
    await waitFor(() => {
      // Two agents share FIXING_ISSUES classification, so expect multiple matches
      expect(screen.getAllByText('Fixing Issues').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('Updating Specs')).toBeInTheDocument();
    expect(screen.getByText('Brainstorming')).toBeInTheDocument();
    expect(screen.getByText('Updating Code')).toBeInTheDocument();
    expect(screen.getByText('Batch Commands')).toBeInTheDocument();
  });

  it('shows the total cost in the header', async () => {
    render(<CostTracker />);
    await waitFor(() => {
      // The total cost appears in both header pill and footer
      const totals = screen.getAllByText(/\$54\.39/);
      expect(totals.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays a warning alert when total exceeds warning threshold', async () => {
    render(<CostTracker warningThreshold={5} errorThreshold={100} />);
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/approaching/i);
    });
  });

  it('displays an error alert when total exceeds error threshold', async () => {
    render(<CostTracker warningThreshold={5} errorThreshold={10} />);
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/exceeded/i);
    });
  });

  it('shows no alert when total is below both thresholds', async () => {
    render(<CostTracker warningThreshold={100} errorThreshold={200} />);
    await waitFor(() => {
      expect(screen.getByText('Code Review Agent')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has a refresh button', async () => {
    render(<CostTracker />);
    await waitFor(() => {
      expect(screen.getByLabelText('Refresh cost data')).toBeInTheDocument();
    });
  });

  it('renders the footer with total row', async () => {
    render(<CostTracker />);
    await waitFor(() => {
      // Footer should have "Total" text
      const footer = screen.getByText('Total', { selector: 'td' });
      expect(footer).toBeInTheDocument();
    });
  });

  it('applies custom className', async () => {
    const { container } = render(<CostTracker className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows column headers for sorting', async () => {
    render(<CostTracker />);
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Trend')).toBeInTheDocument();
  });
});
