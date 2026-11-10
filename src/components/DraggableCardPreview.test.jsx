import { fireEvent, render, screen } from '@testing-library/react';
import DraggableCardPreview from './DraggableCardPreview.jsx';

function renderPreview(props = {}) {
  render(<DraggableCardPreview onClose={vi.fn()} {...props} />);
}

test('renders Cut // Ribbons in the titlebar', () => {
  renderPreview();
  expect(screen.getByText('Cut // Ribbons')).not.toBeNull();
});

test('shows loading spinner initially', () => {
  renderPreview();
  expect(screen.getByRole('status')).not.toBeNull();
  expect(document.querySelector('img').style.display).toBe('none');
});

test('hides spinner and shows image after onLoad', () => {
  renderPreview();
  fireEvent.load(document.querySelector('img'));
  expect(screen.queryByRole('status')).toBeNull();
  expect(document.querySelector('img').style.display).not.toBe('none');
});

test('calls onClose when Close button is clicked', () => {
  const onClose = vi.fn();
  render(<DraggableCardPreview onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalled();
});

test('uses initialPos when provided', () => {
  renderPreview({ initialPos: { x: 500, y: 200 } });
  const el = document.querySelector('.draggable-preview');
  expect(el.style.left).toBe('500px');
  expect(el.style.top).toBe('200px');
});

test('Move here button and size buttons are in the footer', () => {
  renderPreview();
  const footer = document.querySelector('.draggable-window-footer');
  expect(footer.contains(screen.getByRole('button', { name: 'Move here' }))).toBe(true);
  expect(footer.contains(screen.getByRole('button', { name: 'small size' }))).toBe(true);
});

test('Resize preview heading appears in the footer', () => {
  renderPreview();
  expect(document.querySelector('.draggable-preview-resize-label').textContent).toBe('Resize preview');
});

test('small size button is selected by default', () => {
  renderPreview();
  expect(screen.getByRole('button', { name: 'small size' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'normal size' }).getAttribute('aria-pressed')).toBe('false');
});

test('uses initialImageSize when provided', () => {
  renderPreview({ initialImageSize: 'large' });
  expect(screen.getByRole('button', { name: 'large size' }).getAttribute('aria-pressed')).toBe('true');
});

test('clicking a size button calls onSaveSize with the new size', () => {
  const onSaveSize = vi.fn();
  renderPreview({ onSaveSize });
  fireEvent.click(screen.getByRole('button', { name: 'large size' }));
  expect(onSaveSize).toHaveBeenCalledWith('large');
});

test('clicking a size button without onSaveSize does not throw', () => {
  renderPreview();
  expect(() => fireEvent.click(screen.getByRole('button', { name: 'normal size' }))).not.toThrow();
});

test('clicking a size button resets the loading spinner', () => {
  renderPreview();
  fireEvent.load(document.querySelector('img'));
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'normal size' }));
  expect(screen.getByRole('status')).not.toBeNull();
});

test('window width changes with selected size', () => {
  renderPreview();
  const el = document.querySelector('.draggable-preview');
  expect(el.style.width).toBe('160px');
  fireEvent.click(screen.getByRole('button', { name: 'normal size' }));
  expect(el.style.width).toBe('230px');
  fireEvent.click(screen.getByRole('button', { name: 'large size' }));
  expect(el.style.width).toBe('300px');
});

test('image URL includes the selected size version', () => {
  renderPreview();
  expect(document.querySelector('img').src).toContain('version=small');
  fireEvent.click(screen.getByRole('button', { name: 'normal size' }));
  expect(document.querySelector('img').src).toContain('version=normal');
});
