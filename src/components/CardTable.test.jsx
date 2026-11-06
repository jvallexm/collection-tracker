import { fireEvent, render, screen, act } from '@testing-library/react';
import { makeCard } from '../test/fixtures.js';
import CardTable from './CardTable.jsx';

const CARDS = [
  makeCard({ id: 'a', name: 'Arrow', rarity: 'rare', cost: '{W}', number: '11' }),
  makeCard({ id: 'b', name: 'Bolt', rarity: 'common', cost: '{1}{U}', number: '22' }),
  makeCard({ id: 'c', name: 'Charm', rarity: 'common', cost: '{2}{G}', number: '33' }),
];

function renderTable(collection = {}, sort = { key: 'name', direction: 1 }) {
  const handlers = { onQuantityChange: vi.fn(), onFoilQuantityChange: vi.fn(), onSort: vi.fn() };
  render(<CardTable cards={CARDS} collection={collection} sort={sort} {...handlers} />);
  return handlers;
}

describe('CardTable rows', () => {
  test('shows name, single-letter rarity, cost and collector number', () => {
    renderTable();
    expect(screen.getByText('Arrow')).not.toBeNull();
    expect(screen.getByRole('cell', { name: 'R' })).not.toBeNull();
    expect(screen.getByText('W')).not.toBeNull();
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
        onFoilQuantityChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByRole('cell', { name: letter })).not.toBeNull();
  });

  test('shows owned regular quantities and leaves blanks for unowned cards', () => {
    renderTable({ a: { qty: 3 } });
    expect(screen.getByLabelText('Copies of Arrow').value).toBe('3');
    expect(screen.getByLabelText('Copies of Bolt').value).toBe('');
  });

  test('shows owned foil quantities and leaves blanks for unowned cards', () => {
    renderTable({ a: { foil: 2 } });
    expect(screen.getByLabelText('Foil copies of Arrow').value).toBe('2');
    expect(screen.getByLabelText('Foil copies of Bolt').value).toBe('');
  });

  test('shows both qty and foil when a card has both', () => {
    renderTable({ a: { qty: 3, foil: 1 } });
    expect(screen.getByLabelText('Copies of Arrow').value).toBe('3');
    expect(screen.getByLabelText('Foil copies of Arrow').value).toBe('1');
  });

  test('reports typed regular quantities with the card id', () => {
    const { onQuantityChange } = renderTable();
    fireEvent.change(screen.getByLabelText('Copies of Bolt'), { target: { value: '2' } });
    expect(onQuantityChange).toHaveBeenCalledWith('b', '2');
  });

  test('reports typed foil quantities with the card id', () => {
    const { onFoilQuantityChange } = renderTable();
    fireEvent.change(screen.getByLabelText('Foil copies of Bolt'), { target: { value: '1' } });
    expect(onFoilQuantityChange).toHaveBeenCalledWith('b', '1');
  });
});

describe('CardTable headings', () => {
  test.each([
    ['Qty', 'have'],
    ['Name', 'name'],
    ['R', 'rarity'],
    ['Cost', 'cost'],
    ['#', 'number'],
  ])('clicking "%s" asks to sort by %s', (label, key) => {
    const { onSort } = renderTable();
    fireEvent.click(screen.getByRole('columnheader', { name: label }));
    expect(onSort).toHaveBeenCalledWith(key);
  });

  test('Foil column header does not trigger a sort', () => {
    const { onSort } = renderTable();
    fireEvent.click(screen.getByRole('columnheader', { name: 'Foil' }));
    expect(onSort).not.toHaveBeenCalled();
  });
});

describe('CardTable sort indicators', () => {
  test('shows ▲ on the active column when ascending', () => {
    renderTable({}, { key: 'name', direction: 1 });
    expect(screen.getByRole('columnheader', { name: 'Name' }).textContent).toBe('Name ▲');
  });

  test('shows ▼ on the active column when descending', () => {
    renderTable({}, { key: 'rarity', direction: -1 });
    expect(screen.getByRole('columnheader', { name: 'R' }).textContent).toBe('R ▼');
  });

  test('shows no indicator on inactive columns', () => {
    renderTable({}, { key: 'name', direction: 1 });
    expect(screen.getByRole('columnheader', { name: 'R' }).textContent).toBe('R');
    expect(screen.getByRole('columnheader', { name: 'Cost' }).textContent).toBe('Cost');
  });

  test('shows ▲ on Have when sort key is have ascending', () => {
    renderTable({}, { key: 'have', direction: 1 });
    expect(screen.getByRole('columnheader', { name: 'Qty' }).textContent).toBe('Qty ▲');
  });

  test('shows ▼ on Have when sort key is have descending', () => {
    renderTable({}, { key: 'have', direction: -1 });
    expect(screen.getByRole('columnheader', { name: 'Qty' }).textContent).toBe('Qty ▼');
  });

  test('shows no indicator on Have when another column is active', () => {
    renderTable({}, { key: 'name', direction: 1 });
    expect(screen.getByRole('columnheader', { name: 'Qty' }).textContent).toBe('Qty');
  });
});

describe('CardTable keyboard navigation', () => {
  const have = (name) => screen.getByLabelText(`Copies of ${name}`);
  const foil = (name) => screen.getByLabelText(`Foil copies of ${name}`);

  test.each(['s', 'S', 'ArrowDown', 'Enter'])('"%s" moves down within the Have column', (key) => {
    renderTable();
    have('Arrow').focus();
    fireEvent.keyDown(have('Arrow'), { key });
    expect(document.activeElement).toBe(have('Bolt'));
  });

  test.each(['w', 'W', 'ArrowUp'])('"%s" moves up within the Have column', (key) => {
    renderTable();
    have('Charm').focus();
    fireEvent.keyDown(have('Charm'), { key });
    expect(document.activeElement).toBe(have('Bolt'));
  });

  test.each(['s', 'S', 'ArrowDown', 'Enter'])('"%s" moves down within the Foil column', (key) => {
    renderTable();
    foil('Arrow').focus();
    fireEvent.keyDown(foil('Arrow'), { key });
    expect(document.activeElement).toBe(foil('Bolt'));
  });

  test.each(['w', 'W', 'ArrowUp'])('"%s" moves up within the Foil column', (key) => {
    renderTable();
    foil('Charm').focus();
    fireEvent.keyDown(foil('Charm'), { key });
    expect(document.activeElement).toBe(foil('Bolt'));
  });

  test.each(['d', 'D', 'ArrowRight'])('"%s" moves from Have to Foil in the same row', (key) => {
    renderTable();
    have('Bolt').focus();
    fireEvent.keyDown(have('Bolt'), { key });
    expect(document.activeElement).toBe(foil('Bolt'));
  });

  test.each(['a', 'A', 'ArrowLeft'])('"%s" moves from Foil to Have in the same row', (key) => {
    renderTable();
    foil('Bolt').focus();
    fireEvent.keyDown(foil('Bolt'), { key });
    expect(document.activeElement).toBe(have('Bolt'));
  });

  test('stays put at the top of each column', () => {
    renderTable();
    have('Arrow').focus();
    fireEvent.keyDown(have('Arrow'), { key: 'w' });
    expect(document.activeElement).toBe(have('Arrow'));

    foil('Arrow').focus();
    fireEvent.keyDown(foil('Arrow'), { key: 'w' });
    expect(document.activeElement).toBe(foil('Arrow'));
  });

  test('stays put at the bottom of each column', () => {
    renderTable();
    have('Charm').focus();
    fireEvent.keyDown(have('Charm'), { key: 's' });
    expect(document.activeElement).toBe(have('Charm'));

    foil('Charm').focus();
    fireEvent.keyDown(foil('Charm'), { key: 's' });
    expect(document.activeElement).toBe(foil('Charm'));
  });

  test('stays put at the left edge (Have column)', () => {
    renderTable();
    have('Bolt').focus();
    fireEvent.keyDown(have('Bolt'), { key: 'a' });
    expect(document.activeElement).toBe(have('Bolt'));
  });

  test('stays put at the right edge (Foil column)', () => {
    renderTable();
    foil('Bolt').focus();
    fireEvent.keyDown(foil('Bolt'), { key: 'd' });
    expect(document.activeElement).toBe(foil('Bolt'));
  });

  test('ignores other keys so digits can still be typed', () => {
    renderTable();
    const wasNotPrevented = fireEvent.keyDown(have('Arrow'), { key: '5' });
    expect(wasNotPrevented).toBe(true);
  });

  test('prevents the default action for navigation keys', () => {
    renderTable();
    const wasNotPrevented = fireEvent.keyDown(have('Arrow'), { key: 's' });
    expect(wasNotPrevented).toBe(false);
  });

  test('selects the box contents when it receives focus', () => {
    renderTable({ a: { qty: 12 } });
    const input = have('Arrow');
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
        onFoilQuantityChange={vi.fn()}
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
        onFoilQuantityChange={vi.fn()}
        onSort={vi.fn()}
        onTableBlur={onTableBlur}
      />,
    );
    fireEvent.blur(screen.getByLabelText('Copies of Arrow'), { relatedTarget: document.body });
    expect(onTableBlur).toHaveBeenCalled();
  });

  test('does not call onTableBlur when focus moves to another input in the table', () => {
    const onTableBlur = vi.fn();
    render(
      <CardTable
        cards={CARDS}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={vi.fn()}
        onFoilQuantityChange={vi.fn()}
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
        onFoilQuantityChange={vi.fn()}
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
          onFoilQuantityChange={vi.fn()}
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
        onFoilQuantityChange={vi.fn()}
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
            onFoilQuantityChange={vi.fn()}
            onSort={vi.fn()}
          />,
        );
      }),
    ).not.toThrow();
  });
});

describe('CardTable token section', () => {
  const TOKEN = makeCard({ id: 'tok1', name: 'Soldier Token', rarity: 'common', number: 'T1' });

  test('renders no token section when tokenCards is empty', () => {
    renderTable();
    expect(screen.queryByText('Tokens')).toBeNull();
  });

  test('renders a Tokens heading when tokenCards are provided', () => {
    render(
      <CardTable
        cards={CARDS}
        tokenCards={[TOKEN]}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={vi.fn()}
        onFoilQuantityChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByText('Tokens')).not.toBeNull();
  });

  test('renders token card rows after the Tokens heading', () => {
    render(
      <CardTable
        cards={CARDS}
        tokenCards={[TOKEN]}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={vi.fn()}
        onFoilQuantityChange={vi.fn()}
        onSort={vi.fn()}
      />,
    );
    expect(screen.getByText('Soldier Token')).not.toBeNull();
  });

  test('calls onQuantityChange and onFoilQuantityChange for token card inputs', () => {
    const onQuantityChange = vi.fn();
    const onFoilQuantityChange = vi.fn();
    const onInputFocus = vi.fn();
    render(
      <CardTable
        cards={CARDS}
        tokenCards={[TOKEN]}
        collection={{}}
        sort={{ key: 'name', direction: 1 }}
        onQuantityChange={onQuantityChange}
        onFoilQuantityChange={onFoilQuantityChange}
        onInputFocus={onInputFocus}
        onSort={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByLabelText('Copies of Soldier Token'));
    expect(onInputFocus).toHaveBeenCalledWith(TOKEN);
    fireEvent.change(screen.getByLabelText('Copies of Soldier Token'), { target: { value: '2' } });
    expect(onQuantityChange).toHaveBeenCalledWith('tok1', '2');
    fireEvent.focus(screen.getByLabelText('Foil copies of Soldier Token'));
    fireEvent.change(screen.getByLabelText('Foil copies of Soldier Token'), { target: { value: '1' } });
    expect(onFoilQuantityChange).toHaveBeenCalledWith('tok1', '1');
  });
});
