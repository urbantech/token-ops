import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PromptDiff from '../PromptDiff';
import type { PromptRecommendation } from '@/types/prompt';

// Refs #12

const originalPrompt = 'This is the original verbose prompt that contains many unnecessary words and repeated instructions.';

const mockRecommendation: PromptRecommendation = {
  revisedPrompt: 'This is the optimized prompt.',
  tokenReduction: 15,
  tokenReductionPercent: 60,
  performanceEstimate: 90,
  changes: [
    { type: 'remove_redundancy', description: 'Removed unnecessary words', tokensSaved: 8 },
    { type: 'compress_context', description: 'Compressed context', tokensSaved: 7 },
  ],
};

describe('PromptDiff', () => {
  it('renders the Optimization Diff heading', () => {
    render(
      <PromptDiff original={originalPrompt} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Optimization Diff')).toBeInTheDocument();
  });

  it('displays token savings summary', () => {
    render(
      <PromptDiff original={originalPrompt} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('-60%')).toBeInTheDocument();
  });

  it('shows Original and Optimized labels', () => {
    render(
      <PromptDiff original={originalPrompt} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Optimized')).toBeInTheDocument();
  });

  it('displays both prompts', () => {
    render(
      <PromptDiff original={originalPrompt} recommendation={mockRecommendation} />
    );
    expect(screen.getByText(originalPrompt)).toBeInTheDocument();
    expect(screen.getByText('This is the optimized prompt.')).toBeInTheDocument();
  });

  it('renders the changes list', () => {
    render(
      <PromptDiff original={originalPrompt} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Changes Applied')).toBeInTheDocument();
    expect(screen.getByText(/Removed unnecessary words/)).toBeInTheDocument();
    expect(screen.getByText(/Compressed context/)).toBeInTheDocument();
  });

  it('shows token savings per change', () => {
    render(
      <PromptDiff original={originalPrompt} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('(-8 tokens)')).toBeInTheDocument();
    expect(screen.getByText('(-7 tokens)')).toBeInTheDocument();
  });

  it('shows change type badges', () => {
    render(
      <PromptDiff original={originalPrompt} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Redundancy')).toBeInTheDocument();
    expect(screen.getByText('Compress')).toBeInTheDocument();
  });

  it('renders Copy Optimized button', () => {
    render(
      <PromptDiff original={originalPrompt} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Copy Optimized')).toBeInTheDocument();
  });

  it('hides token savings when reduction is 0', () => {
    const noSavingsRec: PromptRecommendation = {
      ...mockRecommendation,
      tokenReduction: 0,
      tokenReductionPercent: 0,
    };
    render(
      <PromptDiff original={originalPrompt} recommendation={noSavingsRec} />
    );
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('hides changes section when no changes', () => {
    const noChangesRec: PromptRecommendation = {
      ...mockRecommendation,
      changes: [],
    };
    render(
      <PromptDiff original={originalPrompt} recommendation={noChangesRec} />
    );
    expect(screen.queryByText('Changes Applied')).not.toBeInTheDocument();
  });
});
