import { act, fireEvent, render, screen } from '@testing-library/react';
import { fetchSets } from '../lib/scryfall.js';
import { loadCards, loadCollection } from '../lib/storage.js';
import MenuBar from './MenuBar.jsx';

vi.mock('../lib/scryfall.js', () => ({ fetchSets: vi.fn() }));
vi.mock('../lib/storage.js', () => ({
  loadCards: vi.fn().mockResolvedValue([]),
  loadCollection: vi.fn().mockResolvedValue({}),
}));

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

test('View menu contains Move card preview option under a Windows heading', () => {
  renderMenu();
  fireEvent.click(screen.getByText('View'));
  expect(screen.getByText('Windows')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Move card preview' })).not.toBeNull();
});

test('clicking Move card preview opens the draggable preview and closes the menu', () => {
  renderMenu();
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
  expect(screen.getByText('Cut // Ribbons')).not.toBeNull();
  expect(screen.queryByText('Light Mode')).toBeNull();
});

test('clicking Move card preview again closes the preview', () => {
  renderMenu();
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
  expect(screen.queryByText('Cut // Ribbons')).toBeNull();
});

test('shows checkmark next to Move card preview when open', () => {
  renderMenu();
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
  fireEvent.click(screen.getByText('View'));
  expect(screen.getByRole('button', { name: 'Move card preview' }).textContent).toMatch(/✓/);
});

test('clicking Close on the draggable preview closes it', () => {
  renderMenu();
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByText('Cut // Ribbons')).toBeNull();
});

test('passes cardPreviewPos to DraggableCardPreview as initial position', () => {
  render(
    <MenuBar
      theme="light"
      onThemeChange={vi.fn()}
      cardPreviewPos={{ x: 500, y: 200 }}
    />,
  );
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
  const el = document.querySelector('.draggable-preview');
  expect(el.style.left).toBe('500px');
  expect(el.style.top).toBe('200px');
});

test('passes cardImageSize to DraggableCardPreview as initial image size', () => {
  render(
    <MenuBar
      theme="light"
      onThemeChange={vi.fn()}
      cardImageSize="large"
    />,
  );
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
  expect(screen.getByRole('button', { name: 'large size' }).getAttribute('aria-pressed')).toBe('true');
});

test('clicking a size button calls onSaveCardImageSize', () => {
  const onSaveCardImageSize = vi.fn();
  render(
    <MenuBar
      theme="light"
      onThemeChange={vi.fn()}
      onSaveCardImageSize={onSaveCardImageSize}
    />,
  );
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
  fireEvent.click(screen.getByRole('button', { name: 'normal size' }));
  expect(onSaveCardImageSize).toHaveBeenCalledWith('normal');
});

test('clicking Move here on preview calls onSaveCardPreviewPos and closes the preview', () => {
  const onSaveCardPreviewPos = vi.fn();
  render(
    <MenuBar
      theme="light"
      onThemeChange={vi.fn()}
      onSaveCardPreviewPos={onSaveCardPreviewPos}
    />,
  );
  fireEvent.click(screen.getByText('View'));
  fireEvent.click(screen.getByRole('button', { name: 'Move card preview' }));
  fireEvent.click(screen.getByRole('button', { name: 'Move here' }));
  expect(onSaveCardPreviewPos).toHaveBeenCalledWith({ x: 300, y: 100 });
  expect(screen.queryByText('Cut // Ribbons')).toBeNull();
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

describe('MenuBar Export Collection menu', () => {
  function renderExport({ onExportCsv = vi.fn() } = {}) {
    render(<MenuBar theme="light" onThemeChange={vi.fn()} onExportCsv={onExportCsv} />);
    return { onExportCsv };
  }

  test('renders the Export Collection menu label', () => {
    renderExport();
    expect(screen.getByText('Export Collection')).not.toBeNull();
  });

  test('Export Collection dropdown is closed by default', () => {
    renderExport();
    expect(screen.queryByRole('button', { name: 'CSV' })).toBeNull();
  });

  test('clicking Export Collection opens a dropdown with CSV option', () => {
    renderExport();
    fireEvent.click(screen.getByText('Export Collection'));
    expect(screen.getByRole('button', { name: 'CSV' })).not.toBeNull();
  });

  test('clicking CSV calls onExportCsv and closes the dropdown', () => {
    const { onExportCsv } = renderExport();
    fireEvent.click(screen.getByText('Export Collection'));
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(onExportCsv).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'CSV' })).toBeNull();
  });
});

describe('MenuBar card search', () => {
  const OPEN_SETS = [{ code: 'ktk', name: 'Khans of Tarkir', minimized: false }];
  const BOLT = { id: 'bolt', name: 'Lightning Bolt', number: '1', set: 'KTK', rarity: 'common', cost: '{R}' };
  const BEAR = { id: 'bear', name: 'Grizzly Bears', number: '2', set: 'KTK', rarity: 'common', cost: '{1}{G}' };

  beforeEach(() => {
    loadCards.mockResolvedValue([BOLT, BEAR]);
    loadCollection.mockResolvedValue({ bolt: { qty: 2 } });
  });

  function renderWithSearch({ onAddCard = vi.fn(), openSets = OPEN_SETS } = {}) {
    render(<MenuBar theme="light" onThemeChange={vi.fn()} openSets={openSets} onAddCard={onAddCard} />);
    return { onAddCard };
  }

  test('renders a card search input', () => {
    renderWithSearch();
    expect(screen.getByPlaceholderText('Search for a card')).not.toBeNull();
  });

  test('shows matching card results when typing', async () => {
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    expect(screen.getByRole('button', { name: /Lightning Bolt/ })).not.toBeNull();
  });

  test('shows current qty in results', async () => {
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    expect(screen.getByText(/KTK.*2|2.*KTK/)).not.toBeNull();
  });

  test('shows no qty text for unowned cards', async () => {
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Grizzly' } });
    await act(async () => {});
    const btn = screen.getByRole('button', { name: /Grizzly Bears/ });
    expect(btn.textContent).not.toMatch(/·/);
  });

  test('shows no results when nothing matches', async () => {
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'zzznomatch' } });
    await act(async () => {});
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  test('calls onAddCard and clears search when a result is clicked', async () => {
    const { onAddCard } = renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /Lightning Bolt/ }));
    expect(onAddCard).toHaveBeenCalledWith('ktk', 'bolt');
    expect(screen.getByPlaceholderText('Search for a card').value).toBe('');
  });

  test('arrow down highlights first result', async () => {
    renderWithSearch();
    const input = screen.getByPlaceholderText('Search for a card');
    fireEvent.change(input, { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /Lightning Bolt/ }).getAttribute('aria-selected')).toBe('true');
  });

  test('arrow down at last result stays at last result', async () => {
    renderWithSearch();
    const input = screen.getByPlaceholderText('Search for a card');
    fireEvent.change(input, { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /Lightning Bolt/ }).getAttribute('aria-selected')).toBe('true');
  });

  test('arrow up from first result clears highlight', async () => {
    renderWithSearch();
    const input = screen.getByPlaceholderText('Search for a card');
    fireEvent.change(input, { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getByRole('button', { name: /Lightning Bolt/ }).getAttribute('aria-selected')).toBe('false');
  });

  test('Enter on highlighted result calls onAddCard and clears search', async () => {
    const { onAddCard } = renderWithSearch();
    const input = screen.getByPlaceholderText('Search for a card');
    fireEvent.change(input, { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddCard).toHaveBeenCalledWith('ktk', 'bolt');
    expect(input.value).toBe('');
  });

  test('Enter without highlight does nothing', async () => {
    const { onAddCard } = renderWithSearch();
    const input = screen.getByPlaceholderText('Search for a card');
    fireEvent.change(input, { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAddCard).not.toHaveBeenCalled();
  });

  test('Escape clears the search', () => {
    renderWithSearch();
    const input = screen.getByPlaceholderText('Search for a card');
    fireEvent.change(input, { target: { value: 'Lightning' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  test('other key press does nothing special', async () => {
    renderWithSearch();
    const input = screen.getByPlaceholderText('Search for a card');
    fireEvent.change(input, { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(screen.getByRole('button', { name: /Lightning Bolt/ })).not.toBeNull();
  });

  test('typing closes any open menu', () => {
    renderWithSearch();
    fireEvent.click(screen.getByText('View'));
    expect(screen.queryByText('Light Mode')).not.toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'L' } });
    expect(screen.queryByText('Light Mode')).toBeNull();
  });

  test('clicking a menu closes the card search results', async () => {
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.click(screen.getByText('View'));
    expect(screen.queryByRole('button', { name: /Lightning Bolt/ })).toBeNull();
  });

  test('clicking outside closes the card search results', async () => {
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    fireEvent.mouseDown(document.body);
    expect(screen.getByPlaceholderText('Search for a card').value).toBe('');
  });

  test('shows Loading while card data is being fetched', async () => {
    let resolveCards;
    loadCards.mockReturnValue(new Promise((r) => { resolveCards = r; }));
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    expect(screen.getByText('Loading…')).not.toBeNull();
    resolveCards([BOLT]);
  });

  test('recovers gracefully when card data load fails', async () => {
    loadCards.mockRejectedValue(new Error('db error'));
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /Lightning Bolt/ })).toBeNull();
  });

  test('resets cached data when openSets changes', async () => {
    const { rerender } = render(
      <MenuBar theme="light" onThemeChange={vi.fn()} openSets={OPEN_SETS} onAddCard={vi.fn()} />,
    );
    // Load data for initial openSets
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    expect(loadCards).toHaveBeenCalledTimes(1);
    // Change openSets — cache resets, next search re-loads
    const newSets = [...OPEN_SETS, { code: 'eld', name: 'Throne of Eldraine', minimized: false }];
    rerender(<MenuBar theme="light" onThemeChange={vi.fn()} openSets={newSets} onAddCard={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Bolt' } });
    await act(async () => {});
    expect(loadCards).toHaveBeenCalledTimes(1 + newSets.length);
  });

  test('does not reload card data when already loaded', async () => {
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    // Change search text — no new loads since data is cached
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Bolt' } });
    await act(async () => {});
    expect(loadCards).toHaveBeenCalledTimes(1);
  });

  test('falls back to empty array when loadCards returns null', async () => {
    loadCards.mockResolvedValue(null);
    renderWithSearch();
    fireEvent.change(screen.getByPlaceholderText('Search for a card'), { target: { value: 'Lightning' } });
    await act(async () => {});
    // No crash, no results (cards array is empty)
    expect(screen.queryByRole('button', { name: /Lightning/ })).toBeNull();
  });
});

describe('MenuBar Debug menu', () => {
  function renderDebug({ activeSet = null, onRefreshSet = vi.fn() } = {}) {
    render(
      <MenuBar
        theme="light"
        onThemeChange={vi.fn()}
        activeSet={activeSet}
        onRefreshSet={onRefreshSet}
      />,
    );
    return { onRefreshSet };
  }

  test('renders the Debug menu label', () => {
    renderDebug();
    expect(screen.getByText('Debug')).not.toBeNull();
  });

  test('Debug dropdown is closed by default', () => {
    renderDebug();
    expect(screen.queryByText('Refresh current set')).toBeNull();
  });

  test('shows No active set when no set is active', () => {
    renderDebug({ activeSet: null });
    fireEvent.click(screen.getByText('Debug'));
    expect(screen.getByText('No active set')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Refresh current set' })).toBeNull();
  });

  test('shows Refresh current set when a set is active', () => {
    renderDebug({ activeSet: { code: 'ktk', name: 'Khans of Tarkir', minimized: false } });
    fireEvent.click(screen.getByText('Debug'));
    expect(screen.getByRole('button', { name: 'Refresh current set' })).not.toBeNull();
  });

  test('clicking Refresh current set calls onRefreshSet and closes the dropdown', () => {
    const { onRefreshSet } = renderDebug({
      activeSet: { code: 'ktk', name: 'Khans of Tarkir', minimized: false },
    });
    fireEvent.click(screen.getByText('Debug'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh current set' }));
    expect(onRefreshSet).toHaveBeenCalled();
    expect(screen.queryByText('Refresh current set')).toBeNull();
  });
});
