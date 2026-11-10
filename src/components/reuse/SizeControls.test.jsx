import { fireEvent, render, screen } from '@testing-library/react';
import SizeControls from './SizeControls.jsx';

test('renders three size buttons: small, normal, large', () => {
  render(<SizeControls imageSize="small" onSizeChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'small size' })).not.toBeNull();
  expect(screen.getByRole('button', { name: 'normal size' })).not.toBeNull();
  expect(screen.getByRole('button', { name: 'large size' })).not.toBeNull();
});

test('the active size button has aria-pressed true, others false', () => {
  render(<SizeControls imageSize="normal" onSizeChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'small size' }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: 'normal size' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'large size' }).getAttribute('aria-pressed')).toBe('false');
});

test('clicking a size button calls onSizeChange with that size', () => {
  const onSizeChange = vi.fn();
  render(<SizeControls imageSize="small" onSizeChange={onSizeChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'large size' }));
  expect(onSizeChange).toHaveBeenCalledWith('large');
});

test('renders the Resize preview label', () => {
  render(<SizeControls imageSize="small" onSizeChange={vi.fn()} />);
  expect(document.querySelector('.draggable-preview-resize-label').textContent).toBe('Resize preview');
});
