import { act, fireEvent, render, screen } from '@testing-library/react';
import { fetchSets } from '../lib/scryfall.js';
import MenuBar from './MenuBar.jsx';

vi.mock('../lib/scryfall.js', () => ({ fetchSets: vi.fn() }));

function renderMenu(theme = 'light') {
  const onThemeChange = vi.fn();
  render(<MenuBar theme={theme} onThemeChange={onThemeChange} />);
  return { onThemeChange };
}

test('clicking inside the menubar does not close the menu', () => {
  renderMenu();
  fireEvent.click(screen.getByText('View'));
  fireEvent.mouseDown(screen.getByText('View'));
  expect(screen.queryByText('Light Mode')).not.toBeNull();
});

test('clicking outside the menubar closes an open menu', () => {
  renderMenu();
  fireEvent.click(screen.getByText('View'));
  fireEvent.mouseDown(document.body);
  expect(screen.queryByText('Light Mode')).toBeNull();
});

test('renders the View menu label', () => {
  renderMenu();
  expect(screen.getByText('View')).not.toBeNull();
});

test('dropdown is closed by default', () => {
  renderMenu();
  expect(screen.queryByText('Light Mode')).toBeNull();
  expect(screen.queryByText('Dark Mode')).toBeNull();
});

test('clicking View opens the dropdown with all three theme items', () => {
  renderMenu();
  fireEvent.click(screen.getByText('View'));
  expect(screen.getByText('Mode')).not.toBeNull();
  expect(screen.getByText('Light Mode')).not.toBeNull();
  expect(screen.getByText('Dark Mode')).not.toBeNull();
  expect(screen.getByText('Synthwave (experimental)')).not.toBeNull();
});

test('clicking View again closes the dropdown', () => {
  renderMenu();
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByText('View'));
  expect(screen.queryByText('Light Mode')).toBeNull();
});

test('clicking Dark Mode calls onThemeChange with dark and closes dropdown', () => {
  const { onThemeChange } = renderMenu('light');
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByText('Dark Mode'));
  expect(onThemeChange).toHaveBeenCalledWith('dark');
  expect(screen.queryByText('Dark Mode')).toBeNull();
});

test('clicking Light Mode calls onThemeChange with light and closes dropdown', () => {
  const { onThemeChange } = renderMenu('dark');
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByText('Light Mode'));
  expect(onThemeChange).toHaveBeenCalledWith('light');
  expect(screen.queryByText('Light Mode')).toBeNull();
});

test('shows a checkmark next to Synthwave when it is the active theme', () => {
  renderMenu('synthwave');
  fireEvent.click(screen.getByText('View'));
  expect(screen.getByText('Synthwave (experimental)').textContent).toMatch(/✓/);
});

test('clicking Synthwave calls onThemeChange with synthwave and closes dropdown', () => {
  const { onThemeChange } = renderMenu('light');
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByText('Synthwave (experimental)'));
  expect(onThemeChange).toHaveBeenCalledWith('synthwave');
  expect(screen.queryByText('Synthwave (experimental)')).toBeNull();
});

describe('MenuBar Add Set menu', () => {
  const SETS = [
    { code: 'ktk', name: 'Khans of Tarkir' },
    { code: 'eld', name: 'Throne of Eldraine' },
    { code: 'znr', name: 'Zendikar Rising' },
  ];

  beforeEach(() => {
    fetchSets.mockResolvedValue(SETS);
  });

  function renderWithSets({ recentSets = [], onOpenSet = vi.fn() } = {}) {
    render(
      <MenuBar
        theme="light"
        onThemeChange={vi.fn()}
        recentSets={recentSets}
        onOpenSet={onOpenSet}
      />,
    );
    return { onOpenSet };
  }

  test('renders the Add Set menu label', () => {
    renderWithSets();
    expect(screen.getByText('Add Set')).not.toBeNull();
  });

  test('Add Set dropdown is closed by default', () => {
    renderWithSets();
    expect(screen.queryByPlaceholderText('Search sets…')).toBeNull();
  });

  test('clicking Add Set opens a dropdown with a search input', () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    expect(screen.getByPlaceholderText('Search sets…')).not.toBeNull();
  });

  test('does not show Recent subheading in Add Set dropdown', () => {
    renderWithSets({ recentSets: [{ code: 'ktk', name: 'Khans of Tarkir' }] });
    fireEvent.click(screen.getByText('Add Set'));
    expect(screen.queryByText('Recent')).toBeNull();
  });

  test('shows a Search subheading above the search input', () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    expect(screen.getByText('Search')).not.toBeNull();
  });

  test('does not show a Results subheading', async () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'khans' } });
    expect(screen.queryByText('Results')).toBeNull();
  });

  test('searching by set code shows matching sets', async () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'eld' } });
    expect(screen.getByRole('button', { name: 'Throne of Eldraine' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Khans of Tarkir' })).toBeNull();
  });

  test('typing filters sets by name', async () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'khans' } });
    expect(screen.getByRole('button', { name: 'Khans of Tarkir' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Throne of Eldraine' })).toBeNull();
  });

  test('clicking a search result calls onOpenSet with code and name and closes the dropdown', async () => {
    const { onOpenSet } = renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'khans' } });
    fireEvent.click(screen.getByRole('button', { name: 'Khans of Tarkir' }));
    expect(onOpenSet).toHaveBeenCalledWith('ktk', 'Khans of Tarkir');
    expect(screen.queryByPlaceholderText('Search sets…')).toBeNull();
  });

  test('recovers gracefully when fetching sets fails', async () => {
    fetchSets.mockRejectedValue(new Error('network error'));
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByPlaceholderText('Search sets…')).not.toBeNull();
  });

  test('fetches sets from Scryfall when the Sets menu is first opened', () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    expect(fetchSets).toHaveBeenCalledTimes(1);
  });

  test('arrow down in search input highlights the first result', async () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'khans' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Search sets…'), { key: 'ArrowDown' });
    expect(
      screen.getByRole('button', { name: 'Khans of Tarkir' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  test('arrow down again moves highlight to the next result', async () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'a' } });
    const input = screen.getByPlaceholderText('Search sets…');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const buttons = screen.getAllByRole('button', { name: /Tarkir|Eldraine|Rising/ });
    expect(buttons[0].getAttribute('aria-selected')).toBe('false');
    expect(buttons[1].getAttribute('aria-selected')).toBe('true');
  });

  test('arrow up from first result clears the highlight', async () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'khans' } });
    const input = screen.getByPlaceholderText('Search sets…');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(
      screen.getByRole('button', { name: 'Khans of Tarkir' }).getAttribute('aria-selected'),
    ).toBe('false');
  });

  test('space bar does nothing when no result is highlighted', async () => {
    const { onOpenSet } = renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'khans' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Search sets…'), { key: ' ' });
    expect(onOpenSet).not.toHaveBeenCalled();
  });

  test('space bar opens the highlighted result', async () => {
    const { onOpenSet } = renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'khans' } });
    const input = screen.getByPlaceholderText('Search sets…');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: ' ' });
    expect(onOpenSet).toHaveBeenCalledWith('ktk', 'Khans of Tarkir');
  });

  test('enter key opens the highlighted result', async () => {
    const { onOpenSet } = renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'khans' } });
    const input = screen.getByPlaceholderText('Search sets…');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOpenSet).toHaveBeenCalledWith('ktk', 'Khans of Tarkir');
  });

  test('enter key does nothing when no result is highlighted', async () => {
    const { onOpenSet } = renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText('Search sets…'), { target: { value: 'khans' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Search sets…'), { key: 'Enter' });
    expect(onOpenSet).not.toHaveBeenCalled();
  });

  test('highlight resets when search text changes', async () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    const input = screen.getByPlaceholderText('Search sets…');
    fireEvent.change(input, { target: { value: 'khans' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: 'khans of' } });
    expect(
      screen.getByRole('button', { name: 'Khans of Tarkir' }).getAttribute('aria-selected'),
    ).toBe('false');
  });

  test('fetches sets only once even when the menu is closed and reopened', async () => {
    renderWithSets();
    fireEvent.click(screen.getByText('Add Set'));
    await act(async () => {});
    fireEvent.click(screen.getByText('Add Set'));
    fireEvent.click(screen.getByText('Add Set'));
    expect(fetchSets).toHaveBeenCalledTimes(1);
  });
});

describe('MenuBar My Collection menu', () => {
  function renderWithRecent({ recentSets = [], onOpenSet = vi.fn() } = {}) {
    render(
      <MenuBar
        theme="light"
        onThemeChange={vi.fn()}
        recentSets={recentSets}
        onOpenSet={onOpenSet}
      />,
    );
    return { onOpenSet };
  }

  test('renders the My Collection menu label', () => {
    renderWithRecent();
    expect(screen.getByText('My Collection')).not.toBeNull();
  });

  test('My Collection dropdown is closed by default', () => {
    renderWithRecent();
    expect(screen.queryByText('Recent')).toBeNull();
  });

  test('clicking My Collection opens the dropdown', () => {
    renderWithRecent();
    fireEvent.click(screen.getByText('My Collection'));
    expect(screen.getByRole('list')).not.toBeNull();
  });

  test('shows Recent subheading and sets when recent sets are provided', () => {
    renderWithRecent({ recentSets: [{ code: 'ktk', name: 'Khans of Tarkir' }] });
    fireEvent.click(screen.getByText('My Collection'));
    expect(screen.getByText('Recent')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Khans of Tarkir' })).not.toBeNull();
  });

  test('shows No recent sets when there are no recent sets', () => {
    renderWithRecent();
    fireEvent.click(screen.getByText('My Collection'));
    expect(screen.getByText('No recent sets')).not.toBeNull();
  });

  test('clicking a recent set calls onOpenSet and closes the dropdown', () => {
    const { onOpenSet } = renderWithRecent({
      recentSets: [{ code: 'ktk', name: 'Khans of Tarkir' }],
    });
    fireEvent.click(screen.getByText('My Collection'));
    fireEvent.click(screen.getByRole('button', { name: 'Khans of Tarkir' }));
    expect(onOpenSet).toHaveBeenCalledWith('ktk', 'Khans of Tarkir');
    expect(screen.queryByText('Recent')).toBeNull();
  });
});
