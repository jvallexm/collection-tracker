import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fetchSetCards } from '../lib/scryfall.js';
import { loadCollection, saveCollection } from '../lib/storage.js';
import { makeCard } from '../test/fixtures.js';
import SetTracker from './SetTracker.jsx';

vi.mock('../lib/scryfall.js', () => ({ fetchSetCards: vi.fn() }));
vi.mock('../lib/storage.js', () => ({
  loadCollection: vi.fn().mockResolvedValue({}),
  saveCollection: vi.fn().mockResolvedValue(undefined),
}));

const CARDS = [
  makeCard({ id: 'b', name: 'Bolt', rarity: 'common', number: '2' }),
  makeCard({ id: 'a', name: 'Arrow', rarity: 'rare', number: '1' }),
  makeCard({ id: 'c', name: 'Charm', rarity: 'common', number: '3' }),
];

const rowNames = () =>
  screen
    .getAllByRole('textbox')
    .map((input) => input.getAttribute('aria-label').replace('Copies of ', ''));

beforeEach(() => {
  loadCollection.mockResolvedValue({});
});

async function renderLoadedTracker() {
  fetchSetCards.mockResolvedValue(CARDS);
  render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
  await screen.findByLabelText('Copies of Arrow');
  await act(async () => {}); // flush async collection load
}

describe('SetTracker loading', () => {
  test('shows a loading state with export disabled', async () => {
    fetchSetCards.mockReturnValue(new Promise(() => {}));
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    expect(screen.getByText('Loading...')).not.toBeNull();
    expect(screen.getByText('Export…').disabled).toBe(true);
    await act(async () => {});
  });

  test('lists the cards alphabetically once loaded', async () => {
    await renderLoadedTracker();
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
    expect(screen.getByText('3 cards | 0 in Collection')).not.toBeNull();
    expect(screen.getByText('Export…').disabled).toBe(false);
  });

  test('shows the error when the cards cannot be loaded', async () => {
    fetchSetCards.mockRejectedValue(new Error('boom'));
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    expect(await screen.findByText('Could not load cards: boom')).not.toBeNull();
    await act(async () => {});
  });
});

describe('SetTracker collection tracking', () => {
  test('updates the summary and saves to the database', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByLabelText('Copies of Arrow'), { target: { value: '2' } });

    expect(screen.getByText('3 cards | 2 in Collection')).not.toBeNull();
    await waitFor(() => {
      expect(saveCollection).toHaveBeenCalledWith('ktk', { a: 2 });
    });
  });

  test('removes a card when its box is cleared', async () => {
    await renderLoadedTracker();
    const input = screen.getByLabelText('Copies of Arrow');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.change(input, { target: { value: '' } });

    expect(screen.getByText('3 cards | 0 in Collection')).not.toBeNull();
  });

  test('restores a previously saved collection', async () => {
    loadCollection.mockResolvedValue({ a: 4 });
    await renderLoadedTracker();
    expect(screen.getByLabelText('Copies of Arrow').value).toBe('4');
  });

  test('preserves a quantity change made before the collection finishes loading', async () => {
    let resolveLoad;
    loadCollection.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    fetchSetCards.mockResolvedValue(CARDS);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Arrow');

    fireEvent.change(screen.getByLabelText('Copies of Arrow'), { target: { value: '3' } });
    resolveLoad({ a: 99 });
    await act(async () => {});

    expect(screen.getByLabelText('Copies of Arrow').value).toBe('3');
  });
});

describe('SetTracker sorting', () => {
  test('clicking the active column reverses it; a new column starts ascending', async () => {
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
    expect(rowNames()).toEqual(['Charm', 'Bolt', 'Arrow']);

    fireEvent.click(screen.getByRole('columnheader', { name: 'Rarity' }));
    expect(rowNames()).toEqual(['Bolt', 'Charm', 'Arrow']);
  });
});

describe('SetTracker have sorting', () => {
  test('clicking Have puts owned cards first regardless of quantity', async () => {
    // Bolt:2, Charm:1 are owned; Arrow:0 is not
    loadCollection.mockResolvedValue({ b: 2, c: 1 });
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Have' }));
    // owned group (Bolt, Charm by name), then unowned (Arrow)
    expect(rowNames()).toEqual(['Bolt', 'Charm', 'Arrow']);
  });

  test('within each group the previous sort order is preserved', async () => {
    // Sort by rarity first: Bolt(C), Charm(C), Arrow(R)
    // Then Have with Arrow+Bolt owned — within owned group rarity order applies
    loadCollection.mockResolvedValue({ a: 1, b: 1 });
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Rarity' }));
    fireEvent.click(screen.getByRole('columnheader', { name: 'Have' }));
    // owned: Bolt(C) before Arrow(R); unowned: Charm
    expect(rowNames()).toEqual(['Bolt', 'Arrow', 'Charm']);
  });

  test('clicking Have again puts unowned cards first', async () => {
    loadCollection.mockResolvedValue({ b: 2, c: 1 });
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Have' }));
    fireEvent.click(screen.getByRole('columnheader', { name: 'Have' }));
    // unowned: Arrow; owned: Bolt, Charm
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });

  test('clicking another column after Have removes have sort', async () => {
    loadCollection.mockResolvedValue({ b: 2, c: 1 });
    await renderLoadedTracker();

    fireEvent.click(screen.getByRole('columnheader', { name: 'Have' }));
    fireEvent.click(screen.getByRole('columnheader', { name: 'Name' }));
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });
});

describe('SetTracker search', () => {
  test('shows all cards when the search box is empty', async () => {
    await renderLoadedTracker();
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });

  test('shows all cards when the search box contains only whitespace', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '   ' } });
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });

  test('filters cards to those whose name matches the search string', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'arr' } });
    expect(rowNames()).toEqual(['Arrow']);
  });

  test('ignores commas in card names when matching', async () => {
    fetchSetCards.mockResolvedValue([
      ...CARDS,
      makeCard({ id: 'd', name: 'Ajani, Outland Liberator', rarity: 'mythic', number: '4' }),
    ]);
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    await screen.findByLabelText('Copies of Ajani, Outland Liberator');
    await act(async () => {});

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ajani out' } });
    expect(rowNames()).toContain('Ajani, Outland Liberator');
    expect(rowNames()).not.toContain('Arrow');
  });

  test('restores all cards when search is cleared', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'arr' } });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
  });
});

describe('SetTracker card preview', () => {
  test('shows a card image when a quantity input is focused', async () => {
    await renderLoadedTracker();
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    expect(screen.getByAltText('Arrow')).not.toBeNull();
  });

  test('updates the preview when focus moves to a different input', async () => {
    await renderLoadedTracker();
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    fireEvent.focus(screen.getByLabelText('Copies of Bolt'));
    expect(screen.getByAltText('Bolt')).not.toBeNull();
    expect(screen.queryByAltText('Arrow')).toBeNull();
  });

  test('hides the preview when focus leaves the table', async () => {
    await renderLoadedTracker();
    const input = screen.getByLabelText('Copies of Arrow');
    fireEvent.focus(input);
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('SetTracker minimize', () => {
  test('title bar has a minimize button', async () => {
    await renderLoadedTracker();
    expect(screen.getByRole('button', { name: 'Minimize' })).not.toBeNull();
  });

  test('clicking minimize hides the card table', async () => {
    await renderLoadedTracker();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  test('minimized icon shows the set name and a restore button', async () => {
    await renderLoadedTracker();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(screen.getByText('Khans of Tarkir')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Restore' })).not.toBeNull();
  });

  test('clicking restore brings back the card table', async () => {
    await renderLoadedTracker();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(screen.getByRole('table')).not.toBeNull();
  });
});

describe('SetTracker export', () => {
  test('opens the Moxfield list and closes again', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByLabelText('Copies of Arrow'), { target: { value: '2' } });

    fireEvent.click(screen.getByText('Export…'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('textarea').value).toBe('2 Arrow (KTK) 1');

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
