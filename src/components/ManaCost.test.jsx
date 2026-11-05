import { render, screen } from '@testing-library/react';
import ManaCost from './ManaCost.jsx';

test('renders nothing for an empty cost', () => {
  const { container } = render(<ManaCost cost="" />);
  expect(container.firstChild).toBeNull();
});

test('renders a regular symbol as plain text with no hybrid markup', () => {
  const { container } = render(<ManaCost cost="{2}{W}" />);
  expect(container.textContent).toBe('2W');
  expect(container.querySelector('.mana-hybrid')).toBeNull();
});

test('renders a hybrid symbol with letter-slash-letter structure', () => {
  const { container } = render(<ManaCost cost="{B/G}" />);
  const hybrid = container.querySelector('.mana-hybrid');
  const letters = hybrid.querySelectorAll('.mana-hybrid-letter');
  const slash = hybrid.querySelector('.mana-hybrid-slash');
  expect(letters[0].textContent).toBe('B');
  expect(slash.textContent).toBe('/');
  expect(letters[1].textContent).toBe('G');
});

test('renders mixed regular and hybrid symbols', () => {
  const { container } = render(<ManaCost cost="{4}{G/W}{G/W}" />);
  expect(container.querySelectorAll('.mana-hybrid')).toHaveLength(2);
  expect(container.textContent).toBe('4G/WG/W');
});

test('renders a 2-or-color hybrid symbol', () => {
  const { container } = render(<ManaCost cost="{2/W}" />);
  const letters = container.querySelectorAll('.mana-hybrid-letter');
  expect(letters[0].textContent).toBe('2');
  expect(letters[1].textContent).toBe('W');
});

test('renders a Phyrexian hybrid symbol', () => {
  const { container } = render(<ManaCost cost="{B/P}" />);
  const letters = container.querySelectorAll('.mana-hybrid-letter');
  expect(letters[0].textContent).toBe('B');
  expect(letters[1].textContent).toBe('P');
});

test('renders a colorless Phyrexian hybrid symbol', () => {
  const { container } = render(<ManaCost cost="{C/P}" />);
  const letters = container.querySelectorAll('.mana-hybrid-letter');
  expect(letters[0].textContent).toBe('C');
  expect(letters[1].textContent).toBe('P');
});

test('renders a split card cost with a separator between faces', () => {
  const { container } = render(<ManaCost cost="{2}{W} // {2}{U}" />);
  expect(container.querySelector('.mana-sep')).not.toBeNull();
  expect(container.querySelectorAll('.mana-cost-face')).toHaveLength(2);
});
