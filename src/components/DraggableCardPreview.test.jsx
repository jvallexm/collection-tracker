import { fireEvent, render, screen } from '@testing-library/react';
import DraggableCardPreview from './DraggableCardPreview.jsx';

function renderPreview(onClose = vi.fn()) {
  render(<DraggableCardPreview onClose={onClose} />);
  return { onClose };
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
  const { onClose } = renderPreview();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalled();
});

test('starts at the default position', () => {
  renderPreview();
  const el = document.querySelector('.draggable-preview');
  expect(el.style.left).toBe('300px');
  expect(el.style.top).toBe('100px');
});

// Drag uses clientX/clientY + stored offset (movementX/Y not settable in jsdom).
// mouseDown at (0,0) → drag.startX = 0-300 = -300, drag.startY = 0-100 = -100
// mouseMove to (20,10) → pos.x = 20-(-300) = 320, pos.y = 10-(-100) = 110
test('dragging titlebar moves the window', () => {
  renderPreview();
  const titlebar = document.querySelector('.draggable-preview .titlebar');
  const el = document.querySelector('.draggable-preview');
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 20, clientY: 10 });
  expect(el.style.left).toBe('320px');
  expect(el.style.top).toBe('110px');
});

test('mouseup stops drag so further mousemoves do not update position', () => {
  renderPreview();
  const titlebar = document.querySelector('.draggable-preview .titlebar');
  const el = document.querySelector('.draggable-preview');
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 10, clientY: 5 });
  fireEvent.mouseUp(document);
  fireEvent.mouseMove(document, { clientX: 60, clientY: 55 });
  expect(el.style.left).toBe('310px');
  expect(el.style.top).toBe('105px');
});

test('titlebar cursor is grabbing while dragging', () => {
  renderPreview();
  const titlebar = document.querySelector('.draggable-preview .titlebar');
  expect(titlebar.style.cursor).toBe('move');
  fireEvent.mouseDown(titlebar);
  expect(titlebar.style.cursor).toBe('grabbing');
  fireEvent.mouseUp(document);
  expect(titlebar.style.cursor).toBe('move');
});

test('Reset button returns the window to the default position', () => {
  renderPreview();
  const titlebar = document.querySelector('.draggable-preview .titlebar');
  const el = document.querySelector('.draggable-preview');
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 100, clientY: 50 });
  fireEvent.mouseUp(document);
  expect(el.style.left).toBe('400px');
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(el.style.left).toBe('300px');
  expect(el.style.top).toBe('100px');
});

test('Move here is enabled when window is on-screen', () => {
  renderPreview();
  expect(screen.getByRole('button', { name: 'Move here' }).disabled).toBe(false);
});

test('Move here is disabled when x is negative', () => {
  renderPreview();
  const titlebar = document.querySelector('.draggable-preview .titlebar');
  fireEvent.mouseDown(titlebar, { clientX: 350, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 0, clientY: 100 });
  expect(screen.getByRole('button', { name: 'Move here' }).disabled).toBe(true);
});

test('Move here is disabled when y is negative', () => {
  renderPreview();
  const titlebar = document.querySelector('.draggable-preview .titlebar');
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 150 });
  fireEvent.mouseMove(document, { clientX: 300, clientY: 0 });
  expect(screen.getByRole('button', { name: 'Move here' }).disabled).toBe(true);
});

test('Move here button and size buttons are in the footer below the image', () => {
  renderPreview();
  const footer = document.querySelector('.draggable-preview-footer');
  expect(footer.contains(screen.getByRole('button', { name: 'Move here' }))).toBe(true);
  expect(footer.contains(screen.getByRole('button', { name: 'small size' }))).toBe(true);
});

test('Resize preview heading appears above the size buttons in the footer', () => {
  renderPreview();
  expect(document.querySelector('.draggable-preview-resize-label').textContent).toBe('Resize preview');
});

test('clicking Move here calls onSavePos with current position', () => {
  const onSavePos = vi.fn();
  render(<DraggableCardPreview onClose={vi.fn()} onSavePos={onSavePos} />);
  fireEvent.click(screen.getByRole('button', { name: 'Move here' }));
  expect(onSavePos).toHaveBeenCalledWith({ x: 300, y: 100 });
});

test('clicking Move here calls onClose', () => {
  const onClose = vi.fn();
  render(<DraggableCardPreview onClose={onClose} onSavePos={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Move here' }));
  expect(onClose).toHaveBeenCalled();
});

test('clicking Move here after dragging saves the new position', () => {
  const onSavePos = vi.fn();
  render(<DraggableCardPreview onClose={vi.fn()} onSavePos={onSavePos} />);
  const titlebar = document.querySelector('.draggable-preview .titlebar');
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 50, clientY: 20 });
  fireEvent.mouseUp(document);
  fireEvent.click(screen.getByRole('button', { name: 'Move here' }));
  expect(onSavePos).toHaveBeenCalledWith({ x: 350, y: 120 });
});

test('clicking Move here without onSavePos does not throw', () => {
  render(<DraggableCardPreview onClose={vi.fn()} />);
  expect(() => fireEvent.click(screen.getByRole('button', { name: 'Move here' }))).not.toThrow();
});

test('uses initialPos when provided', () => {
  render(<DraggableCardPreview onClose={vi.fn()} initialPos={{ x: 500, y: 200 }} />);
  const el = document.querySelector('.draggable-preview');
  expect(el.style.left).toBe('500px');
  expect(el.style.top).toBe('200px');
});

test('renders three size buttons: small, normal, large', () => {
  renderPreview();
  expect(screen.getByRole('button', { name: 'small size' })).not.toBeNull();
  expect(screen.getByRole('button', { name: 'normal size' })).not.toBeNull();
  expect(screen.getByRole('button', { name: 'large size' })).not.toBeNull();
});

test('small size button is selected by default', () => {
  renderPreview();
  expect(screen.getByRole('button', { name: 'small size' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'normal size' }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: 'large size' }).getAttribute('aria-pressed')).toBe('false');
});

test('clicking a size button selects it and deselects the others', () => {
  renderPreview();
  fireEvent.click(screen.getByRole('button', { name: 'normal size' }));
  expect(screen.getByRole('button', { name: 'small size' }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: 'normal size' }).getAttribute('aria-pressed')).toBe('true');
});

test('clicking a size button calls onSaveSize with the new size', () => {
  const onSaveSize = vi.fn();
  render(<DraggableCardPreview onClose={vi.fn()} onSaveSize={onSaveSize} />);
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

test('uses initialImageSize when provided', () => {
  render(<DraggableCardPreview onClose={vi.fn()} initialImageSize="large" />);
  expect(screen.getByRole('button', { name: 'large size' }).getAttribute('aria-pressed')).toBe('true');
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

test('userSelect is none while dragging', () => {
  renderPreview();
  const titlebar = document.querySelector('.draggable-preview .titlebar');
  const el = document.querySelector('.draggable-preview');
  expect(el.style.userSelect).toBe('');
  fireEvent.mouseDown(titlebar);
  expect(el.style.userSelect).toBe('none');
  fireEvent.mouseUp(document);
  expect(el.style.userSelect).toBe('');
});
