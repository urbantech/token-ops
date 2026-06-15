import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SavingsOpportunities } from '../SavingsOpportunities';
import { mockSavingsOpportunities, type SavingsOpportunity } from '@/lib/mock-data';

// Refs #11

const sampleOpportunities: SavingsOpportunity[] = [
  {
    id: 'dup-prompts',
    type: 'duplicate_prompts',
    title: 'Duplicate Prompts',
    subtitle: 'Identical or near-identical requests detected',
    count: 143,
    estimatedSavingsMonthly: 8.42,
    priority: 'high',
    details: [
      '143 duplicate requests identified in the last 30 days',
      'Response caching could eliminate 89% of duplicates',
    ],
  },
  {
    id: 'expensive-models',
    type: 'expensive_models',
    title: 'Expensive Models',
    subtitle: 'Models that could be downgraded for common tasks',
    count: 3,
    estimatedSavingsMonthly: 29.46,
    priority: 'high',
    details: [
      'Code Review Agent using Opus → Sonnet saves $11.56',
      'Total potential: 3 model downgrades',
    ],
  },
  {
    id: 'batch-patterns',
    type: 'batch_patterns',
    title: 'Batch Patterns',
    subtitle: 'Repetitive commands that could be scripted',
    count: 7,
    estimatedSavingsMonthly: 12.18,
    priority: 'medium',
    details: [
      '7 repetitive command patterns detected this month',
    ],
  },
  {
    id: 'memory-reuse',
    type: 'memory_reuse',
    title: 'Memory Reuse',
    subtitle: 'Cached context available but not utilised',
    count: 56,
    estimatedSavingsMonthly: 4.87,
    priority: 'low',
    details: [
      '56 conversations reloading identical context from scratch',
    ],
  },
];

describe('SavingsOpportunities', () => {
  it('renders the section header', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    expect(screen.getByText('Savings Opportunities')).toBeInTheDocument();
  });

  it('renders a card for each opportunity', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    expect(screen.getByText('Duplicate Prompts')).toBeInTheDocument();
    expect(screen.getByText('Expensive Models')).toBeInTheDocument();
    expect(screen.getByText('Batch Patterns')).toBeInTheDocument();
    expect(screen.getByText('Memory Reuse')).toBeInTheDocument();
  });

  it('shows subtitle text for each card', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    expect(screen.getByText('Identical or near-identical requests detected')).toBeInTheDocument();
    expect(screen.getByText('Models that could be downgraded for common tasks')).toBeInTheDocument();
  });

  it('shows priority badges on each card', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    const highBadges = screen.getAllByText('high');
    expect(highBadges.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('displays the count of high-priority items in the header', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    // 2 high-priority items
    expect(screen.getByText(/2 high-priority items/i)).toBeInTheDocument();
  });

  it('uses singular "item" when only one high-priority opportunity', () => {
    const singleHigh = sampleOpportunities.filter(o => o.id !== 'expensive-models');
    render(<SavingsOpportunities opportunities={singleHigh} />);
    expect(screen.getByText(/1 high-priority item/i)).toBeInTheDocument();
  });

  it('shows the total monthly savings amount', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    // 8.42 + 29.46 + 12.18 + 4.87 = 54.93
    expect(screen.getByText(/\$54\.93\/mo/)).toBeInTheDocument();
  });

  it('shows per-card monthly savings', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    expect(screen.getByText(/Save \$8\.42\/mo/)).toBeInTheDocument();
    expect(screen.getByText(/Save \$29\.46\/mo/)).toBeInTheDocument();
    expect(screen.getByText(/Save \$12\.18\/mo/)).toBeInTheDocument();
    expect(screen.getByText(/Save \$4\.87\/mo/)).toBeInTheDocument();
  });

  it('shows instance counts on each card', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    expect(screen.getByText('143')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('56')).toBeInTheDocument();
  });

  it('does not show details section before expanding', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('shows details when a card is clicked', async () => {
    const user = userEvent.setup();
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);

    const card = screen.getByRole('button', { name: /Duplicate Prompts/i });
    await user.click(card);

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('143 duplicate requests identified in the last 30 days')).toBeInTheDocument();
  });

  it('hides details when the same card is clicked again', async () => {
    const user = userEvent.setup();
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);

    const card = screen.getByRole('button', { name: /Duplicate Prompts/i });
    await user.click(card);
    expect(screen.getByText('Details')).toBeInTheDocument();

    await user.click(card);
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('shows all detail bullet points when expanded', async () => {
    const user = userEvent.setup();
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);

    const card = screen.getByRole('button', { name: /Duplicate Prompts/i });
    await user.click(card);

    expect(screen.getByText('143 duplicate requests identified in the last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Response caching could eliminate 89% of duplicates')).toBeInTheDocument();
  });

  it('calls onOpportunityClick when a card is clicked', async () => {
    const user = userEvent.setup();
    const onOpportunityClick = vi.fn();
    render(
      <SavingsOpportunities
        opportunities={sampleOpportunities}
        onOpportunityClick={onOpportunityClick}
      />
    );

    const card = screen.getByRole('button', { name: /Expensive Models/i });
    await user.click(card);

    expect(onOpportunityClick).toHaveBeenCalledTimes(1);
    expect(onOpportunityClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'expensive-models' })
    );
  });

  it('sets aria-expanded to true on an expanded card', async () => {
    const user = userEvent.setup();
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);

    const card = screen.getByRole('button', { name: /Duplicate Prompts/i });
    expect(card).toHaveAttribute('aria-expanded', 'false');

    await user.click(card);
    expect(card).toHaveAttribute('aria-expanded', 'true');
  });

  it('uses default mock opportunities when no prop is provided', () => {
    render(<SavingsOpportunities />);
    // mockSavingsOpportunities has 4 items
    expect(screen.getByText('Savings Opportunities')).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(4);
  });

  it('applies custom className', () => {
    const { container } = render(
      <SavingsOpportunities
        opportunities={sampleOpportunities}
        className="test-savings"
      />
    );
    expect(container.firstChild).toHaveClass('test-savings');
  });

  it('shows "available savings" label', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    expect(screen.getByText('available savings')).toBeInTheDocument();
  });

  it('renders the Instances label on each card', () => {
    render(<SavingsOpportunities opportunities={sampleOpportunities} />);
    const instanceLabels = screen.getAllByText('Instances:');
    expect(instanceLabels).toHaveLength(4);
  });

  it('handles an empty opportunities array gracefully', () => {
    render(<SavingsOpportunities opportunities={[]} />);
    expect(screen.getByText('Savings Opportunities')).toBeInTheDocument();
    // 0 high priority
    expect(screen.getByText(/0 high-priority items/i)).toBeInTheDocument();
    // total savings = $0.00
    expect(screen.getByText(/\$0\.00\/mo/)).toBeInTheDocument();
  });
});
