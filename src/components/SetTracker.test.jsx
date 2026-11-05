import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { loadCollection, saveCollection } from '../lib/storage.js';
import { fetchSetCards } from '../lib/scryfall.js';
import { makeCard } from '../test/fixtures.js';
import SetTracker from './SetTracker.jsx';

vi.mock('../lib/scryfall.js', () => ({ fetchSetCards: vi.fn() }));

const CARDS = [
  makeCard({ id: 'b', name: 'Bolt', rarity: 'common', number: '2' }),
  makeCard({ id: 'a', name: 'Arrow', rarity: 'rare', number: '1' }),
  makeCard({ id: 'c', name: 'Charm', rarity: 'common', number: '3' }),
];

const rowNames = () =>
  screen
    .getAllByRole('textbox')
    .map((input) => input.getAttribute('aria-label').replace('Copies of ', ''));

async function renderLoadedTracker() {
  fetchSetCards.mockResolvedValue(CARDS);
  render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
  await screen.findByLabelText('Copies of Arrow');
}

describe('SetTracker loading', () => {
  test('shows a loading state with export disabled', async () => {
    fetchSetCards.mockReturnValue(new Promise(() => {}));
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    expect(screen.getByText('Loading...')).not.toBeNull();
    expect(screen.getByText('Export...').disabled).toBe(true);
    await act(async () => {}); // flush async IDB collection load
  });

  test('lists the cards alphabetically once loaded', async () => {
    await renderLoadedTracker();
    expect(rowNames()).toEqual(['Arrow', 'Bolt', 'Charm']);
    expect(screen.getByText('3 cards | 0 unique owned | 0 total copies')).not.toBeNull();
    expect(screen.getByText('Export...').disabled).toBe(false);
  });

  test('shows the error when the cards cannot be loaded', async () => {
    fetchSetCards.mockRejectedValue(new Error('boom'));
    render(<SetTracker setCode="ktk" setName="Khans of Tarkir" />);
    expect(await screen.findByText('Could not load cards: boom')).not.toBeNull();
  });
});

describe('SetTracker collection tracking', () => {
  test('updates the summary and saves to the database', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByLabelText('Copies of Arrow'), { target: { value: '2' } });

    expect(screen.getByText('3 cards | 1 unique owned | 2 total copies')).not.toBeNull();
    await waitFor(async () => {
      expect(await loadCollection('ktk')).toEqual({ a: 2 });
    });
  });

  test('removes a card when its box is cleared', async () => {
    await renderLoadedTracker();
    const input = screen.getByLabelText('Copies of Arrow');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.change(input, { target: { value: '' } });

    expect(screen.getByText('3 cards | 0 unique owned | 0 total copies')).not.toBeNull();
  });

  test('restores a previously saved collection', async () => {
    await saveCollection('ktk', { a: 4 });
    await renderLoadedTracker();
    await waitFor(() => {
      expect(screen.getByLabelText('Copies of Arrow').value).toBe('4');
    });
  });
});

describe('SetTracker sorting', () => {
  test('clicking the active column reverses it; a new column starts ascending', async () => {
    await renderLoadedTracker();

    fireEvent.click(screen.getByText('Name'));
    expect(rowNames()).toEqual(['Charm', 'Bolt', 'Arrow']);

    fireEvent.click(screen.getByText('Rarity'));
    expect(rowNames()).toEqual(['Bolt', 'Charm', 'Arrow']);
  });
});

describe('SetTracker export', () => {
  test('opens the Moxfield list and closes again', async () => {
    await renderLoadedTracker();
    fireEvent.change(screen.getByLabelText('Copies of Arrow'), { target: { value: '2' } });

    fireEvent.click(screen.getByText('Export...'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('textarea').value).toBe('2 Arrow (KTK) 1');

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
