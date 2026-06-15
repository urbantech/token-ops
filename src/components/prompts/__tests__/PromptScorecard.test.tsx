import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PromptScorecard from '../PromptScorecard';
import { Classification } from '@/types/telemetry';
import type { PromptAnalysis, PromptRecommendation } from '@/types/prompt';

// Refs #12

const mockAnalysis: PromptAnalysis = {
  id: 'test-1',
  originalPrompt: 'Some verbose test prompt with repeated instructions',
  tokenCount: 250,
  verbosityScore: 65,
  duplicationScore: 40,
  contextWasteScore: 55,
  repeatedInstructions: [
    { text: 'Make sure to follow best practices', count: 3, wastedTokens: 42 },
  ],
  overallScore: 53,
  classification: Classification.UPDATING_CODE,
  analyzedAt: new Date().toISOString(),
};

const mockRecommendation: PromptRecommendation = {
  revisedPrompt: 'Shorter optimized prompt',
  tokenReduction: 80,
  tokenReductionPercent: 32,
  performanceEstimate: 88,
  changes: [
    { type: 'remove_redundancy', description: 'Removed repeated instructions', tokensSaved: 42 },
  ],
};

describe('PromptScorecard', () => {
  it('renders the Scorecard heading', () => {
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Scorecard')).toBeInTheDocument();
  });

  it('renders score labels for all metrics', () => {
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Verbosity')).toBeInTheDocument();
    expect(screen.getByText('Duplication')).toBeInTheDocument();
    expect(screen.getByText('Context Waste')).toBeInTheDocument();
    expect(screen.getByText('Overall Waste')).toBeInTheDocument();
  });

  it('displays score values', () => {
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('65')).toBeInTheDocument(); // verbosity
    expect(screen.getByText('40')).toBeInTheDocument(); // duplication
    expect(screen.getByText('55')).toBeInTheDocument(); // context waste
    expect(screen.getByText('53')).toBeInTheDocument(); // overall
  });

  it('displays token count', () => {
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('250 tokens')).toBeInTheDocument();
  });

  it('shows potential savings badge when tokenReduction > 0', () => {
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('-32% potential savings')).toBeInTheDocument();
  });

  it('hides savings badge when tokenReduction is 0', () => {
    const noSavingsRec: PromptRecommendation = {
      ...mockRecommendation,
      tokenReduction: 0,
      tokenReductionPercent: 0,
    };
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={noSavingsRec} />
    );
    expect(screen.queryByText(/potential savings/)).not.toBeInTheDocument();
  });

  it('displays classification badge', () => {
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Updating Code')).toBeInTheDocument();
  });

  it('shows repeated instructions count', () => {
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('1 repeated instruction')).toBeInTheDocument();
  });

  it('shows repeated instruction details', () => {
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Repeated Instructions')).toBeInTheDocument();
    expect(
      screen.getByText(/Make sure to follow best practices/)
    ).toBeInTheDocument();
  });

  it('shows performance estimate', () => {
    render(
      <PromptScorecard analysis={mockAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.getByText('Quality estimate: 88/100')).toBeInTheDocument();
  });

  it('hides repeated instructions section when none exist', () => {
    const noRepeatsAnalysis: PromptAnalysis = {
      ...mockAnalysis,
      repeatedInstructions: [],
    };
    render(
      <PromptScorecard analysis={noRepeatsAnalysis} recommendation={mockRecommendation} />
    );
    expect(screen.queryByText('Repeated Instructions')).not.toBeInTheDocument();
  });
});
