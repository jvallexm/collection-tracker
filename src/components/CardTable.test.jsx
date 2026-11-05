import { fireEvent, render, screen, act } from '@testing-library/react';
import { makeCard } from '../test/fixtures.js';
import CardTable from './CardTable.jsx';

const CARDS = [
  makeCard({ id: 'a', name: 'Arrow', rarity: 'rare', cost: '{W}', number: '11' }),
  makeCard({ id: 'b', name: 'Bolt', rarity: 'common', cost: '{1}{U}', number: '22' }),
  makeCard({ id: 'c', name: 'Charm', rarity: 'common', cost: '{2}{G}', number: '33' }),
];

function renderTable(collection = {}, sort = { key: 'name', direction: 1 }) {
  const handlers = { onQuantityChange: vi.fn(), onSort: vi.fn() };
  render(<CardTable cards={CARDS} collection={collection} sort={sort} {...handlers} />);
  return handlers;
}

describe('CardTable rows', () => {
  test('shows name, single-letter rarity, cost and collector number', () => {
    renderTable();
    expect(screen.getByText('Arrow')).not.toBeNull();
    expect(screen.getByText('R')).not.toBeNull(); // rarity: rare → R
    expect(screen.getByText('W')).not.toBeNull(); // cost: {W} → W
    expect(screen.queryByText('Rare')).toBeNull();
    expect(screen.getByText('11')).not.toBeNull();
  });

  test.each([
    ['common', 'C'],
    ['uncommon', 'U'],
    ['rare', 'R'],
    ['mythic', 'M'],
  ])('%s displays as %s', (rarity, letter) => {
    render(
      <CardTable
        cards={[makeCard({ id: '1', name: 'Test', rarity })]}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByText(letter)).not.toBeNull();
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
    ['Have', 'have'],
    ['Name', 'name'],
    ['Rarity', 'rarity'],
    ['Cost', 'cost'],
    ['#', 'number'],
  ])('clicking "%s" asks to sort by %s', (label, key) => {
    const { onSort } = renderTable();
    fireEvent.click(screen.getByRole('columnheader', { name: label }));
    expect(onSort).toHaveBeenCalledWith(key);
  });
});

describe('CardTable sort indicators', () => {
  test('shows ▲ on the active column when ascending', () => {
    renderTable({}, { key: 'name', direction: 1 });
    expect(screen.getByRole('columnheader', { name: 'Name' }).textContent).toBe('Name ▲');
  });

  test('shows ▼ on the active column when descending', () => {
    renderTable({}, { key: 'rarity', direction: -1 });
    expect(screen.getByRole('columnheader', { name: 'Rarity' }).textContent).toBe('Rarity ▼');
  });

  test('shows no indicator on inactive columns', () => {
    renderTable({}, { key: 'name', direction: 1 });
    expect(screen.getByRole('columnheader', { name: 'Rarity' }).textContent).toBe('Rarity');
    expect(screen.getByRole('columnheader', { name: 'Cost' }).textContent).toBe('Cost');
  });

  test('shows ▲ on Have when sort key is have ascending', () => {
    renderTable({}, { key: 'have', direction: 1 });
    expect(screen.getByRole('columnheader', { name: 'Have' }).textContent).toBe('Have ▲');
  });

  test('shows ▼ on Have when sort key is have descending', () => {
    renderTable({}, { key: 'have', direction: -1 });
    expect(screen.getByRole('columnheader', { name: 'Have' }).textContent).toBe('Have ▼');
  });

  test('shows no indicator on Have when another column is active', () => {
    renderTable({}, { key: 'name', direction: 1 });
    expect(screen.getByRole('columnheader', { name: 'Have' }).textContent).toBe('Have');
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

  test('calls onInputFocus with the card when an input gains focus', () => {
    const onInputFocus = vi.fn();
    render(
      <CardTable
        cards={CARDS}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={vi.fn()}
        onSort={vi.fn()}
        onInputFocus={onInputFocus}
      />,
    );
    fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
    expect(onInputFocus).toHaveBeenCalledWith(expect.objectContaining({ name: 'Arrow' }));
  });

  test('calls onTableBlur when focus moves outside the table', () => {
    const onTableBlur = vi.fn();
    render(
      <CardTable
        cards={CARDS}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={vi.fn()}
        onSort={vi.fn()}
        onTableBlur={onTableBlur}
      />,
    );
    fireEvent.blur(screen.getByLabelText('Copies of Arrow'), { relatedTarget: document.body });
    expect(onTableBlur).toHaveBeenCalled();
  });

  test('does not call onTableBlur when focus moves to another input in the table', () => {
    const onTableBlur = vi.fn();
    const { container } = render(
      <CardTable
        cards={CARDS}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={vi.fn()}
        onSort={vi.fn()}
        onTableBlur={onTableBlur}
      />,
    );
    const inputs = screen.getAllByRole('textbox');
    fireEvent.blur(inputs[0], { relatedTarget: inputs[1] });
    expect(onTableBlur).not.toHaveBeenCalled();
  });
});

describe('CardTable scroll on sort', () => {
  test('scrolls the focused input into view when the card order changes', () => {
    const { rerender } = render(
      <CardTable
        cards={CARDS}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );
    const input = screen.getByLabelText('Copies of Arrow');
    input.focus();
    input.scrollIntoView = vi.fn();

    act(() => {
      rerender(
        <CardTable
          cards={[...CARDS].reverse()}
          collection={{}}
          sort={{ key: 'name', direction: -1 }}
          onQuantityChange={vi.fn()}
          onSort={vi.fn()}
        />,
      );
    });

    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  test('does nothing when no input is focused during a sort', () => {
    const { rerender } = render(
      <CardTable
        cards={CARDS}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );
    document.body.focus();

    expect(() =>
      act(() => {
        rerender(
          <CardTable
            cards={[...CARDS].reverse()}
            collection={{}}
            sort={{ key: 'name', direction: -1 }}
            onQuantityChange={vi.fn()}
            onSort={vi.fn()}
          />,
        );
      }),
    ).not.toThrow();
  });
});
