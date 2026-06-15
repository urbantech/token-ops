import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelCostComparison } from '../ModelCostComparison';
import { mockModelComparisons, type ModelComparison } from '@/lib/mock-data';

// Refs #12

describe('ModelCostComparison', () => {
  it('renders the header', () => {
    render(<ModelCostComparison />);
    expect(screen.getByText('Model Cost Comparison')).toBeInTheDocument();
  });

  it('renders sort buttons', () => {
    render(<ModelCostComparison />);
    expect(screen.getByRole('button', { name: '$ Savings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '% Savings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Current Cost' })).toBeInTheDocument();
  });

  it('renders current model names', () => {
    render(<ModelCostComparison />);
    expect(screen.getByText('claude-opus-4-6')).toBeInTheDocument();
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
  });

  it('shows recommended models', () => {
    render(<ModelCostComparison />);
    // claude-sonnet-4-6 can appear as both a current model in one row and a
    // recommended model in another, so use getAllByText to handle multiples.
    expect(screen.getAllByText('claude-sonnet-4-6').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
    expect(screen.getByText('claude-haiku-3-5')).toBeInTheDocument();
  });

  it('shows "Already optimal" for models with no savings', () => {
    render(<ModelCostComparison />);
    expect(screen.getByText('Already optimal')).toBeInTheDocument();
  });

  it('renders summary bar with totals', () => {
    render(<ModelCostComparison />);
    expect(screen.getByText('Current Monthly')).toBeInTheDocument();
    expect(screen.getByText('Projected Monthly')).toBeInTheDocument();
    expect(screen.getByText('Potential Savings')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<ModelCostComparison />);
    expect(screen.getByRole('columnheader', { name: 'Current Model' })).toBeInTheDocument();
    // 'Current Cost' appears as both a sort button and a column header — assert the header specifically
    expect(screen.getByRole('columnheader', { name: 'Current Cost' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Projected' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Savings' })).toBeInTheDocument();
  });

  it('expands row details on click', async () => {
    const user = userEvent.setup();
    render(<ModelCostComparison />);

    // Click a table row
    const row = screen.getByText('claude-opus-4-6').closest('tr');
    expect(row).not.toBeNull();
    await user.click(row!);

    // Should show the use case details
    expect(screen.getByText('Use Case')).toBeInTheDocument();
    expect(screen.getByText('Trade-offs')).toBeInTheDocument();
  });

  it('collapses expanded row on second click', async () => {
    const user = userEvent.setup();
    render(<ModelCostComparison />);

    const row = screen.getByText('claude-opus-4-6').closest('tr');
    await user.click(row!);
    expect(screen.getByText('Use Case')).toBeInTheDocument();

    await user.click(row!);
    expect(screen.queryByText('Use Case')).not.toBeInTheDocument();
  });

  it('accepts custom data', () => {
    const customData: ModelComparison[] = [
      {
        currentModel: 'test-model',
        currentProvider: 'TestProvider',
        currentCostPer1k: 0.01,
        currentMonthlyTokens: 100_000,
        currentMonthlyCost: 1.00,
        recommendedModel: 'test-model-lite',
        recommendedProvider: 'TestProvider',
        recommendedCostPer1k: 0.005,
        projectedMonthlyCost: 0.50,
        savingsAmount: 0.50,
        savingsPercent: 50,
        useCase: 'Test use case',
        tradeoffs: 'Test tradeoffs',
      },
    ];
    render(<ModelCostComparison data={customData} />);
    expect(screen.getByText('test-model')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ModelCostComparison className="test-cls" />
    );
    expect(container.firstChild).toHaveClass('test-cls');
  });

  it('shows helpful hint text', () => {
    render(<ModelCostComparison />);
    expect(
      screen.getByText(/Click any row to see use case details/)
    ).toBeInTheDocument();
  });
});
