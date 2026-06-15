import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageIndicator, type UsageItem } from '../UsageIndicator';

// Refs #11

const sampleItems: UsageItem[] = [
  { label: 'API Calls', current: 750, max: 1000, unit: ' calls' },
  { label: 'Tokens', current: 85000, max: 100000 },
  { label: 'Storage', current: 50, max: 100, unit: ' GB' },
];

describe('UsageIndicator', () => {
  it('renders nothing when items array is empty', () => {
    const { container } = render(<UsageIndicator items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a bar for each item', () => {
    render(<UsageIndicator items={sampleItems} />);
    expect(screen.getByText('API Calls')).toBeInTheDocument();
    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
  });

  it('displays current/max values', () => {
    render(<UsageIndicator items={[{ label: 'Calls', current: 200, max: 500 }]} />);
    expect(screen.getByText(/200/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('shows percentage badge in non-compact mode', () => {
    render(
      <UsageIndicator items={[{ label: 'Test', current: 50, max: 100 }]} />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows warning message when usage exceeds warning threshold', () => {
    render(
      <UsageIndicator
        items={[{ label: 'Quota', current: 85, max: 100 }]}
        warningThreshold={80}
        criticalThreshold={95}
      />
    );
    expect(screen.getByText(/Warning: usage is above 80%/)).toBeInTheDocument();
  });

  it('shows critical message when usage exceeds critical threshold', () => {
    render(
      <UsageIndicator
        items={[{ label: 'Quota', current: 96, max: 100 }]}
        warningThreshold={80}
        criticalThreshold={95}
      />
    );
    expect(screen.getByText(/Critical: usage is above 95%/)).toBeInTheDocument();
  });

  it('does not show warning for usage below threshold', () => {
    render(
      <UsageIndicator
        items={[{ label: 'Quota', current: 30, max: 100 }]}
        warningThreshold={80}
        criticalThreshold={95}
      />
    );
    expect(screen.queryByText(/Warning/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Critical/)).not.toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    render(
      <UsageIndicator
        items={[{ label: 'Calls', current: 500, max: 1000 }]}
        compact
      />
    );
    expect(screen.getByText('Calls')).toBeInTheDocument();
    // Compact mode should NOT show the percentage badge
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('handles zero max value gracefully', () => {
    render(
      <UsageIndicator items={[{ label: 'Zero Max', current: 0, max: 0 }]} />
    );
    expect(screen.getByText('Zero Max')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('caps percentage at 100 when current exceeds max', () => {
    render(
      <UsageIndicator items={[{ label: 'Over', current: 150, max: 100 }]} />
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <UsageIndicator items={sampleItems} className="my-class" />
    );
    expect(container.firstChild).toHaveClass('my-class');
  });

  it('uses custom formatValue function', () => {
    const items: UsageItem[] = [
      {
        label: 'Custom',
        current: 42,
        max: 100,
        formatValue: (v) => `${v} units`,
      },
    ];
    render(<UsageIndicator items={items} />);
    expect(screen.getByText(/42 units/)).toBeInTheDocument();
    expect(screen.getByText(/100 units/)).toBeInTheDocument();
  });

  it('uses default formatting for large numbers', () => {
    render(
      <UsageIndicator
        items={[{ label: 'Big', current: 1500000, max: 2000000 }]}
      />
    );
    expect(screen.getByText(/1\.5M/)).toBeInTheDocument();
    expect(screen.getByText(/2\.0M/)).toBeInTheDocument();
  });
});
