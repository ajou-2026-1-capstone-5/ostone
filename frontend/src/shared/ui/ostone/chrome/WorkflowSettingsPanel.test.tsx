import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowSettingsPanel, type WorkflowSettingEntry } from './WorkflowSettingsPanel';

function makeEntry(overrides: Partial<WorkflowSettingEntry> = {}): WorkflowSettingEntry {
  return {
    key: 'sort',
    label: 'Sort',
    value: 'asc',
    options: [
      { value: 'asc', label: 'Asc' },
      { value: 'desc', label: 'Desc' },
    ],
    onChange: vi.fn(),
    ...overrides,
  };
}

describe('WorkflowSettingsPanel', () => {
  it('renders one chip per option and marks the active value', () => {
    render(<WorkflowSettingsPanel entries={[makeEntry()]} testId="panel" />);
    expect(screen.getByTestId('panel-sort-asc').dataset.active).toBe('true');
    expect(screen.getByTestId('panel-sort-desc').dataset.active).toBe('false');
  });

  it('invokes onChange when a chip is clicked', () => {
    const onChange = vi.fn();
    render(<WorkflowSettingsPanel entries={[makeEntry({ onChange })]} testId="panel" />);

    fireEvent.click(screen.getByTestId('panel-sort-desc'));
    expect(onChange).toHaveBeenCalledWith('desc');
  });

  it('supports multiple entries', () => {
    const onTop = vi.fn();
    render(
      <WorkflowSettingsPanel
        entries={[
          makeEntry(),
          {
            key: 'top',
            label: 'Top N',
            value: 5,
            options: [
              { value: 3, label: '3' },
              { value: 5, label: '5' },
              { value: 10, label: '10' },
            ],
            onChange: onTop,
          },
        ]}
        testId="panel"
      />,
    );

    fireEvent.click(screen.getByTestId('panel-top-10'));
    expect(onTop).toHaveBeenCalledWith(10);
  });

  it('uses default testId when none supplied', () => {
    render(<WorkflowSettingsPanel entries={[makeEntry()]} />);
    expect(screen.getByTestId('workflow-settings-panel')).toBeInTheDocument();
  });
});
