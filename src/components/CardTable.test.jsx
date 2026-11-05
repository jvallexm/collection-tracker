import { fireEvent, render, screen } from '@testing-library/react';
import { makeCard } from '../test/fixtures.js';
import CardTable from './CardTable.jsx';

const CARDS = [
  makeCard({ id: 'a', name: 'Arrow', rarity: 'rare', cost: '{R}', number: '11' }),
  makeCard({ id: 'b', name: 'Bolt', rarity: 'common', cost: '{1}{U}', number: '22' }),
  makeCard({ id: 'c', name: 'Charm', rarity: 'common', cost: '{2}{G}', number: '33' }),
];

function renderTable(collection = {}) {
  const handlers = { onQuantityChange: vi.fn(), onSort: vi.fn() };
  render(<CardTable cards={CARDS} collection={collection} {...handlers} />);
  return handlers;
}

describe('CardTable rows', () => {
  test('shows name, capitalized rarity, cost and collector number', () => {
    renderTable();
    expect(screen.getByText('Arrow')).not.toBeNull();
    expect(screen.getByText('Rare')).not.toBeNull();
    expect(screen.getByText('{R}')).not.toBeNull();
    expect(screen.getByText('11')).not.toBeNull();
  });

  test('shows owned quantities and leaves other boxes blank', () => {
    renderTable({ a: 3 });
    expect(screen.getByLabelText('Copies of Arrow').value).toBe('3');
    expect(screen.getByLabelText('Copies of Bolt').value).toBe('');
  });

  test('reports typed quantities with the card id', () => {
    const { onQuantityChange } = renderTable();
    fireEvent.change(screen.getByLabelText('Copies of Bolt'), { target: { value: '2' } });
    expect(onQuantityChange).toHaveBeenCalledWith('b', '2');
  });
});

describe('CardTable headings', () => {
  test.each([
    ['Name', 'name'],
    ['Rarity', 'rarity'],
    ['Cost', 'cost'],
    ['#', 'number'],
  ])('clicking "%s" asks to sort by %s', (label, key) => {
    const { onSort } = renderTable();
    fireEvent.click(screen.getByText(label));
    expect(onSort).toHaveBeenCalledWith(key);
  });
});

describe('CardTable keyboard navigation', () => {
  const getInputs = () => screen.getAllByRole('textbox');

  test.each(['s', 'S', 'ArrowDown', 'Enter'])('"%s" moves to the next box', (key) => {
    renderTable();
    const inputs = getInputs();
    inputs[0].focus();
    fireEvent.keyDown(inputs[0], { key });
    expect(document.activeElement).toBe(inputs[1]);
  });

  test.each(['w', 'W', 'ArrowUp'])('"%s" moves to the previous box', (key) => {
    renderTable();
    const inputs = getInputs();
    inputs[2].focus();
    fireEvent.keyDown(inputs[2], { key });
    expect(document.activeElement).toBe(inputs[1]);
  });

  test('stays put at the first and last boxes', () => {
    renderTable();
    const inputs = getInputs();

    inputs[0].focus();
    fireEvent.keyDown(inputs[0], { key: 'w' });
    expect(document.activeElement).toBe(inputs[0]);

    inputs[2].focus();
    fireEvent.keyDown(inputs[2], { key: 's' });
    expect(document.activeElement).toBe(inputs[2]);
  });

  test('ignores other keys so digits can still be typed', () => {
    renderTable();
    const wasNotPrevented = fireEvent.keyDown(getInputs()[0], { key: '5' });
    expect(wasNotPrevented).toBe(true);
  });

  test('prevents the default action for navigation keys', () => {
    renderTable();
    const wasNotPrevented = fireEvent.keyDown(getInputs()[0], { key: 's' });
    expect(wasNotPrevented).toBe(false);
  });

  test('selects the box contents when it receives focus', () => {
    renderTable({ a: 12 });
    const input = getInputs()[0];
    input.select = vi.fn();
    fireEvent.focus(input);
    expect(input.select).toHaveBeenCalled();
  });
});
