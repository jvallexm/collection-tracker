import { fireEvent, render, screen } from '@testing-library/react';
import QuantityCell from './QuantityCell.jsx';

function renderCell(props = {}) {
  return render(
    <table>
      <tbody>
        <tr>
          <QuantityCell
            col="have"
            label="Copies of Arrow"
            value=""
            onFocus={() => {}}
            onChange={() => {}}
            {...props}
          />
        </tr>
      </tbody>
    </table>,
  );
}

test('renders an input inside a .qty-cell td', () => {
  const { container } = renderCell();
  expect(container.querySelector('td.qty-cell input.qty-input')).not.toBeNull();
});

test('sets data-col on the input', () => {
  const { container } = renderCell({ col: 'foil' });
  expect(container.querySelector('input').getAttribute('data-col')).toBe('foil');
});

test('sets aria-label on the input', () => {
  renderCell({ label: 'Foil copies of Arrow' });
  expect(screen.getByLabelText('Foil copies of Arrow')).not.toBeNull();
});

test('reflects the value prop', () => {
  renderCell({ value: '3' });
  expect(screen.getByLabelText('Copies of Arrow').value).toBe('3');
});

test('calls onChange when the input changes', () => {
  const onChange = vi.fn();
  renderCell({ onChange });
  fireEvent.change(screen.getByLabelText('Copies of Arrow'), { target: { value: '2' } });
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('calls onFocus when the input is focused', () => {
  const onFocus = vi.fn();
  renderCell({ onFocus });
  fireEvent.focus(screen.getByLabelText('Copies of Arrow'));
  expect(onFocus).toHaveBeenCalledTimes(1);
});
