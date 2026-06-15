import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BatchPatternAlert } from '../BatchPatternAlert';
import { mockBatchPatterns, type DetectedBatchPattern } from '@/lib/mock-data';

// Refs #11

const samplePatterns: DetectedBatchPattern[] = [
  {
    id: 'test-1',
    pattern: 'Run tests and report failures',
    frequency: 89,
    totalCost: 4.23,
    totalTokens: 534_000,
    estimatedSavings: 3.38,
    samplePrompts: [
      'Run the test suite and tell me what failed',
      'Execute all tests and summarise the failures',
    ],
    scriptTemplate: '#!/bin/bash\npytest --tb=short 2>&1',
  },
  {
    id: 'test-2',
    pattern: 'Lint and auto-fix code',
    frequency: 54,
    totalCost: 2.87,
    totalTokens: 312_000,
    estimatedSavings: 2.15,
    samplePrompts: [
      'Run the linter and fix any issues',
    ],
    scriptTemplate: '#!/bin/bash\nnpx eslint . --fix',
  },
];

describe('BatchPatternAlert', () => {
  let clipboardWriteText: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Ensure navigator.clipboard exists and is configurable for jsdom
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async () => {} },
        writable: true,
        configurable: true,
      });
    }
    clipboardWriteText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the alert banner with pattern count', () => {
    render(<BatchPatternAlert patterns={samplePatterns} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/2 repetitive patterns detected/i)).toBeInTheDocument();
  });

  it('renders singular "pattern" when only one pattern', () => {
    render(<BatchPatternAlert patterns={[samplePatterns[0]]} />);
    expect(screen.getByText(/1 repetitive pattern detected/i)).toBeInTheDocument();
  });

  it('displays the calculated total savings', () => {
    render(<BatchPatternAlert patterns={samplePatterns} />);
    // Total savings = 3.38 + 2.15 = 5.53
    expect(screen.getByText(/\$5\.53\/month/i)).toBeInTheDocument();
  });

  it('uses provided totalSavings prop instead of calculating from patterns', () => {
    render(<BatchPatternAlert patterns={samplePatterns} totalSavings={99.99} />);
    expect(screen.getByText(/\$99\.99\/month/i)).toBeInTheDocument();
  });

  it('shows total occurrence count', () => {
    render(<BatchPatternAlert patterns={samplePatterns} />);
    // frequency: 89 + 54 = 143
    expect(screen.getByText(/143 total occurrences/i)).toBeInTheDocument();
  });

  it('renders nothing when patterns array is empty', () => {
    const { container } = render(<BatchPatternAlert patterns={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('dismisses the alert when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    const dismissBtn = screen.getByLabelText('Dismiss batch pattern alert');
    await user.click(dismissBtn);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onDismiss callback when dismissed', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<BatchPatternAlert patterns={samplePatterns} onDismiss={onDismiss} />);

    await user.click(screen.getByLabelText('Dismiss batch pattern alert'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows "View Patterns" button when collapsed', () => {
    render(<BatchPatternAlert patterns={samplePatterns} />);
    expect(screen.getByText(/View Patterns/i)).toBeInTheDocument();
  });

  it('expands to show pattern list when "View Patterns" is clicked', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));

    expect(screen.getByText('Run tests and report failures')).toBeInTheDocument();
    expect(screen.getByText('Lint and auto-fix code')).toBeInTheDocument();
  });

  it('shows "Hide" button after expanding', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));

    expect(screen.getByText('Hide')).toBeInTheDocument();
  });

  it('collapses the pattern list when "Hide" is clicked', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));
    expect(screen.getByText('Run tests and report failures')).toBeInTheDocument();

    await user.click(screen.getByText('Hide'));
    expect(screen.queryByText('Run tests and report failures')).not.toBeInTheDocument();
  });

  it('shows frequency and cost info for each pattern when expanded', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));

    expect(screen.getByText(/89 occurrences/)).toBeInTheDocument();
    expect(screen.getByText(/\$4\.23 spent/)).toBeInTheDocument();
  });

  it('shows estimated savings per pattern when expanded', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));

    expect(screen.getByText(/Save \$3\.38\/mo/)).toBeInTheDocument();
    expect(screen.getByText(/Save \$2\.15\/mo/)).toBeInTheDocument();
  });

  it('shows "Generate Script" buttons for each pattern when expanded', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));

    const generateBtns = screen.getAllByText(/Generate Script/i);
    expect(generateBtns).toHaveLength(2);
  });

  it('expands individual pattern row when "Generate Script" is clicked', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));

    const generateBtns = screen.getAllByText(/Generate Script/i);
    await user.click(generateBtns[0]);

    expect(screen.getByText(/Sample Prompts/i)).toBeInTheDocument();
    expect(screen.getByText(/Generated Script/i)).toBeInTheDocument();
  });

  it('shows sample prompts in the expanded row', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));
    await user.click(screen.getAllByText(/Generate Script/i)[0]);

    expect(screen.getByText(/Run the test suite and tell me what failed/)).toBeInTheDocument();
  });

  it('displays the script template in expanded row', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));
    await user.click(screen.getAllByText(/Generate Script/i)[0]);

    expect(screen.getByText(/pytest --tb=short/)).toBeInTheDocument();
  });

  it('calls onGenerateScript callback when "Generate Script" is clicked', async () => {
    const user = userEvent.setup();
    const onGenerateScript = vi.fn();
    render(
      <BatchPatternAlert
        patterns={samplePatterns}
        onGenerateScript={onGenerateScript}
      />
    );

    await user.click(screen.getByText(/View Patterns/i));
    await user.click(screen.getAllByText(/Generate Script/i)[0]);

    expect(onGenerateScript).toHaveBeenCalledTimes(1);
    expect(onGenerateScript).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-1' })
    );
  });

  it('copies script template to clipboard when "Copy" is clicked', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));
    await user.click(screen.getAllByText(/Generate Script/i)[0]);
    await user.click(screen.getByText(/Copy/i));

    expect(clipboardWriteText).toHaveBeenCalledWith(
      samplePatterns[0].scriptTemplate
    );
  });

  it('shows "Copied" feedback after clicking copy', async () => {
    const user = userEvent.setup();
    render(<BatchPatternAlert patterns={samplePatterns} />);

    await user.click(screen.getByText(/View Patterns/i));
    await user.click(screen.getAllByText(/Generate Script/i)[0]);
    await user.click(screen.getByText(/Copy/i));

    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('renders using default mock data when no patterns prop provided', () => {
    render(<BatchPatternAlert />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // mockBatchPatterns has 3 items
    expect(screen.getByText(/3 repetitive patterns detected/i)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <BatchPatternAlert patterns={samplePatterns} className="custom-alert" />
    );
    expect(container.firstChild).toHaveClass('custom-alert');
  });
});
