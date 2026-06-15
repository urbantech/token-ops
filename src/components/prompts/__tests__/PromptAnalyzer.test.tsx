import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptAnalyzer from '../PromptAnalyzer';
import { Classification } from '@/types/telemetry';

// Refs #12

const mockAnalysis = {
  id: 'a1',
  originalPrompt: 'test prompt',
  tokenCount: 12,
  verbosityScore: 45,
  duplicationScore: 20,
  contextWasteScore: 30,
  repeatedInstructions: [],
  overallScore: 35,
  classification: Classification.UPDATING_CODE,
  analyzedAt: new Date().toISOString(),
};

const mockRecommendation = {
  revisedPrompt: 'optimized prompt',
  tokenReduction: 4,
  tokenReductionPercent: 33,
  performanceEstimate: 85,
  changes: [],
};

describe('PromptAnalyzer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the title', () => {
    render(<PromptAnalyzer onAnalysis={vi.fn()} />);
    expect(screen.getByText('Prompt Analyzer')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<PromptAnalyzer onAnalysis={vi.fn()} />);
    expect(
      screen.getByText(/Paste a prompt to analyze verbosity/)
    ).toBeInTheDocument();
  });

  it('renders a textarea and analyze button', () => {
    render(<PromptAnalyzer onAnalysis={vi.fn()} />);
    expect(screen.getByPlaceholderText('Paste your prompt here...')).toBeInTheDocument();
    expect(screen.getByText('Analyze Prompt')).toBeInTheDocument();
  });

  it('disables analyze button when textarea is empty', () => {
    render(<PromptAnalyzer onAnalysis={vi.fn()} />);
    expect(screen.getByText('Analyze Prompt')).toBeDisabled();
  });

  it('enables analyze button when text is entered', async () => {
    const user = userEvent.setup();
    render(<PromptAnalyzer onAnalysis={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Paste your prompt here...'), 'test');
    expect(screen.getByText('Analyze Prompt')).toBeEnabled();
  });

  it('shows token count for entered text', async () => {
    const user = userEvent.setup();
    render(<PromptAnalyzer onAnalysis={vi.fn()} />);
    await user.type(
      screen.getByPlaceholderText('Paste your prompt here...'),
      'Hello world test'
    );
    // Token count should appear (ceil(16/4) = 4)
    expect(screen.getByText(/4 tokens/)).toBeInTheDocument();
  });

  it('calls onAnalysis with scorecard after successful analysis', async () => {
    const user = userEvent.setup();
    const onAnalysis = vi.fn();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockAnalysis }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockRecommendation }),
      });

    render(<PromptAnalyzer onAnalysis={onAnalysis} />);
    await user.type(
      screen.getByPlaceholderText('Paste your prompt here...'),
      'Write a function'
    );
    await user.click(screen.getByText('Analyze Prompt'));

    await waitFor(() => {
      expect(onAnalysis).toHaveBeenCalledWith({
        analysis: mockAnalysis,
        recommendation: mockRecommendation,
      });
    });
  });

  it('shows error message on analysis API failure', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Analysis failed' }),
    });

    render(<PromptAnalyzer onAnalysis={vi.fn()} />);
    await user.type(
      screen.getByPlaceholderText('Paste your prompt here...'),
      'test prompt'
    );
    await user.click(screen.getByText('Analyze Prompt'));

    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeInTheDocument();
    });
  });

  it('clears text and error when Clear button is clicked', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Failed' }),
    });

    render(<PromptAnalyzer onAnalysis={vi.fn()} />);
    const textarea = screen.getByPlaceholderText('Paste your prompt here...');
    await user.type(textarea, 'test');
    await user.click(screen.getByText('Analyze Prompt'));

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear'));
    expect(textarea).toHaveValue('');
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  it('respects external isLoading prop', () => {
    render(<PromptAnalyzer onAnalysis={vi.fn()} isLoading={true} />);
    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
  });
});
