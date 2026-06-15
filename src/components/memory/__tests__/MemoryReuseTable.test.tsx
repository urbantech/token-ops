import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryReuseTable } from '../MemoryReuseTable';

// Refs #11

const mockRecommendations = {
  duplicateQueries: [
    {
      query: 'How to implement authentication?',
      frequency: 12,
      tokensConsumed: 45000,
      potentialSavings: 38000,
      avgSimilarity: 0.94,
    },
    {
      query: 'What is the deploy process?',
      frequency: 8,
      tokensConsumed: 28000,
      potentialSavings: 22000,
      avgSimilarity: 0.88,
    },
  ],
  repeatedResearch: [
    {
      query: 'Best practices for error handling',
      frequency: 5,
      tokensConsumed: 18000,
      potentialSavings: 12000,
      avgSimilarity: 0.82,
    },
  ],
  repeatedWorkflows: [
    {
      workflowName: 'Code Review Pipeline',
      frequency: 15,
      avgCost: 2000,
      totalCost: 30000,
    },
  ],
  totalPotentialSavings: 72000,
};

describe('MemoryReuseTable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRecommendations),
    });
  });

  it('renders the heading', async () => {
    render(<MemoryReuseTable />);
    expect(screen.getByText('Memory Reuse Opportunities')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<MemoryReuseTable />);
    expect(screen.getByText('Loading recommendations...')).toBeInTheDocument();
  });

  it('renders query rows after data loads', async () => {
    render(<MemoryReuseTable />);
    await waitFor(() => {
      expect(
        screen.getByText('How to implement authentication?')
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText('What is the deploy process?')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Best practices for error handling')
    ).toBeInTheDocument();
  });

  it('shows total potential savings', async () => {
    render(<MemoryReuseTable />);
    await waitFor(() => {
      expect(screen.getByText(/72,000 tokens saveable/)).toBeInTheDocument();
    });
  });

  it('shows repeated queries count', async () => {
    render(<MemoryReuseTable />);
    await waitFor(() => {
      expect(screen.getByText(/3 repeated queries found/)).toBeInTheDocument();
    });
  });

  it('renders time range selector', () => {
    render(<MemoryReuseTable />);
    expect(screen.getByText('24h')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();
  });

  it('switches time range on click', async () => {
    const user = userEvent.setup();
    render(<MemoryReuseTable />);

    await user.click(screen.getByText('30d'));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('timeRange=30d')
    );
  });

  it('renders Cache This buttons', async () => {
    render(<MemoryReuseTable />);
    await waitFor(() => {
      const cacheButtons = screen.getAllByText('Cache This');
      expect(cacheButtons.length).toBe(3);
    });
  });

  it('marks row as cached when Cache This is clicked', async () => {
    const user = userEvent.setup();
    render(<MemoryReuseTable />);

    await waitFor(() => {
      expect(screen.getAllByText('Cache This').length).toBe(3);
    });

    const firstCacheBtn = screen.getAllByText('Cache This')[0];
    await user.click(firstCacheBtn);

    expect(screen.getByText('Cached')).toBeInTheDocument();
    expect(screen.getAllByText('Cache This').length).toBe(2);
  });

  it('renders repeated workflows section', async () => {
    render(<MemoryReuseTable />);
    await waitFor(() => {
      expect(screen.getByText('Repeated Workflows')).toBeInTheDocument();
    });
    expect(screen.getByText('Code Review Pipeline')).toBeInTheDocument();
  });

  it('shows empty state when no duplicates found', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          duplicateQueries: [],
          repeatedResearch: [],
          repeatedWorkflows: [],
          totalPotentialSavings: 0,
        }),
    });

    render(<MemoryReuseTable />);
    await waitFor(() => {
      expect(
        screen.getByText(/No duplicate queries found/)
      ).toBeInTheDocument();
    });
  });

  it('renders column headers', async () => {
    render(<MemoryReuseTable />);
    await waitFor(() => {
      expect(screen.getByText('Query')).toBeInTheDocument();
    });
    expect(screen.getByText('Freq')).toBeInTheDocument();
    expect(screen.getByText('Tokens Used')).toBeInTheDocument();
    expect(screen.getByText('Saveable')).toBeInTheDocument();
    expect(screen.getByText('Similarity')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
