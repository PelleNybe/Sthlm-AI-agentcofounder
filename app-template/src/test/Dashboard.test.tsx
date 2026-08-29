import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from '../Dashboard';

// Mock Recharts to avoid DOM measurement issues in JSDOM and unknown SVG elements
vi.mock('recharts', async () => {
  const OriginalRecharts = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...OriginalRecharts,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: '100%', height: 400 }} data-testid="recharts-responsive-container">
        {children}
      </div>
    ),
    LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
    AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
    Line: () => <div data-testid="line-series" />,
    Area: () => <div data-testid="area-series" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
  };
});

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders loading state initially', () => {
    // Override fetch to hang
    global.fetch = vi.fn(() => new Promise(() => {})) as any;
    render(<Dashboard />);
    expect(screen.getByText('Initializing Workspace...')).toBeDefined();
  });

  it('falls back to synthetic data on fetch failure', async () => {
    // Suppress React warning about SVG elements inside recharts AreaChart mock which JS DOM doesn't understand
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    render(<Dashboard />);

    // Should transition from loading to showing data
    await waitFor(() => {
      expect(screen.queryByText('Initializing Workspace...')).toBeNull();
    }, { timeout: 2000 });

    expect(screen.getByText('System Telemetry')).toBeDefined();
    // Default config uses AreaChart
    expect(screen.getByTestId('area-chart')).toBeDefined();

    consoleSpy.mockRestore();
  });

  it('renders real data when fetch succeeds', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockData = [
      { time: '01:00', activity: 42 },
      { time: '02:00', activity: 84 }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData
    }) as any;

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('System Telemetry')).toBeDefined();
    });

    expect(screen.getByTestId('area-chart')).toBeDefined();

    consoleSpy.mockRestore();
  });
});
