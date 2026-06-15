import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryStats } from '../MemoryStats';

// Refs #11

const mockStats = {
  totalMemories: 1234,
  reuseRate: 34.5,
  avgConfidence: 0.876,
  topCategories: [
    { category: 'knowledge', count: 450, percentage: 36.5 },
    { category: 'conversation', count: 320, percentage: 25.9 },
    { category: 'task', count: 200, percentage: 16.2 },
  ],
  totalTokensSaved: 890000,
  totalTokensConsumed: 2500000,
};

describe('MemoryStats', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeletons initially', () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {}) // never resolves
    );
    const { container } = render(<MemoryStats />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(4);
  });

  it('renders stat cards after data loads', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });

    render(<MemoryStats />);

    await waitFor(() => {
      expect(screen.getByText('Total Memories')).toBeInTheDocument();
    });
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Reuse Rate')).toBeInTheDocument();
    expect(screen.getByText('34.5%')).toBeInTheDocument();
    expect(screen.getByText('Tokens Saved')).toBeInTheDocument();
    expect(screen.getByText('Avg Confidence')).toBeInTheDocument();
  });

  it('displays savings percentage', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });

    render(<MemoryStats />);

    await waitFor(() => {
      expect(screen.getByText('35.6% of total consumption')).toBeInTheDocument();
    });
  });

  it('renders top categories', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });

    render(<MemoryStats />);

    await waitFor(() => {
      expect(screen.getByText('Top Categories')).toBeInTheDocument();
    });
    expect(screen.getByText('knowledge')).toBeInTheDocument();
    expect(screen.getByText('conversation')).toBeInTheDocument();
    expect(screen.getByText('task')).toBeInTheDocument();
  });

  it('renders nothing when API fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
    });

    const { container } = render(<MemoryStats />);

    await waitFor(() => {
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(0);
    });
  });

  it('handles fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const { container } = render(<MemoryStats />);

    await waitFor(() => {
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(0);
    });
  });

  it('shows confidence as percentage', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });

    render(<MemoryStats />);

    await waitFor(() => {
      expect(screen.getByText('87.6%')).toBeInTheDocument();
    });
  });
});
