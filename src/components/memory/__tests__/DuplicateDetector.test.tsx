import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DuplicateDetector } from '../DuplicateDetector';

// Refs #11

const mockDuplicateResult = {
  isDuplicate: true,
  confidence: 0.92,
  priorAnswer: 'This is a cached response from memory.',
  memoryReference: 'mem-abc123',
  tokensSaved: 1500,
};

const mockUniqueResult = {
  isDuplicate: false,
  confidence: 0.15,
  priorAnswer: null,
  memoryReference: null,
  tokensSaved: 0,
};

describe('DuplicateDetector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the heading', () => {
    render(<DuplicateDetector />);
    expect(screen.getByText('Duplicate Request Detector')).toBeInTheDocument();
  });

  it('renders the input field and detect button', () => {
    render(<DuplicateDetector />);
    expect(
      screen.getByPlaceholderText(/Enter a query to check for duplicates/)
    ).toBeInTheDocument();
    expect(screen.getByText('Detect')).toBeInTheDocument();
  });

  it('disables the button when input is empty', () => {
    render(<DuplicateDetector />);
    const button = screen.getByText('Detect');
    expect(button).toBeDisabled();
  });

  it('enables the button when input has text', async () => {
    const user = userEvent.setup();
    render(<DuplicateDetector />);
    const input = screen.getByPlaceholderText(/Enter a query/);
    await user.type(input, 'test query');
    expect(screen.getByText('Detect')).toBeEnabled();
  });

  it('shows "Duplicate Found" badge for duplicate results', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDuplicateResult),
    });

    render(<DuplicateDetector />);
    const input = screen.getByPlaceholderText(/Enter a query/);
    await user.type(input, 'How do I set up authentication?');
    await user.click(screen.getByText('Detect'));

    await waitFor(() => {
      expect(screen.getByText('Duplicate Found')).toBeInTheDocument();
    });
  });

  it('shows "Unique Request" badge for non-duplicate results', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockUniqueResult),
    });

    render(<DuplicateDetector />);
    const input = screen.getByPlaceholderText(/Enter a query/);
    await user.type(input, 'unique question');
    await user.click(screen.getByText('Detect'));

    await waitFor(() => {
      expect(screen.getByText('Unique Request')).toBeInTheDocument();
    });
  });

  it('shows the cached answer when a duplicate is found', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDuplicateResult),
    });

    render(<DuplicateDetector />);
    const input = screen.getByPlaceholderText(/Enter a query/);
    await user.type(input, 'test');
    await user.click(screen.getByText('Detect'));

    await waitFor(() => {
      expect(screen.getByText('Cached Answer')).toBeInTheDocument();
      expect(
        screen.getByText('This is a cached response from memory.')
      ).toBeInTheDocument();
    });
  });

  it('displays tokens saved count', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDuplicateResult),
    });

    render(<DuplicateDetector />);
    const input = screen.getByPlaceholderText(/Enter a query/);
    await user.type(input, 'test');
    await user.click(screen.getByText('Detect'));

    await waitFor(() => {
      expect(screen.getByText(/1,500 tokens saved/)).toBeInTheDocument();
    });
  });

  it('shows confidence percentage', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDuplicateResult),
    });

    render(<DuplicateDetector />);
    const input = screen.getByPlaceholderText(/Enter a query/);
    await user.type(input, 'test');
    await user.click(screen.getByText('Detect'));

    await waitFor(() => {
      expect(screen.getByText('92.0% confidence')).toBeInTheDocument();
    });
  });

  it('shows error message on API failure', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Service unavailable' }),
    });

    render(<DuplicateDetector />);
    const input = screen.getByPlaceholderText(/Enter a query/);
    await user.type(input, 'test');
    await user.click(screen.getByText('Detect'));

    await waitFor(() => {
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    });
  });

  it('triggers detection on Enter key press', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockUniqueResult),
    });

    render(<DuplicateDetector />);
    const input = screen.getByPlaceholderText(/Enter a query/);
    await user.type(input, 'test{Enter}');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
