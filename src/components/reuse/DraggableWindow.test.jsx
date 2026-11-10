import { fireEvent, render, screen } from '@testing-library/react';
import DraggableWindow from './DraggableWindow.jsx';

function renderWindow({ children = <div>body</div>, ...props } = {}) {
  render(
    <DraggableWindow title="Test Window" onClose={vi.fn()} {...props}>
      {children}
    </DraggableWindow>
  );
  return document.querySelector('.draggable-window');
}

test('renders title in the titlebar', () => {
  renderWindow();
  expect(screen.getByText('Test Window')).not.toBeNull();
});

test('renders children', () => {
  renderWindow({ children: <div>my content</div> });
  expect(screen.getByText('my content')).not.toBeNull();
});

test('renders controls when provided', () => {
  renderWindow({ controls: <div>size controls</div> });
  expect(screen.getByText('size controls')).not.toBeNull();
});

test('renders Close button that calls onClose', () => {
  const onClose = vi.fn();
  render(<DraggableWindow title="T" onClose={onClose}><div /></DraggableWindow>);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalled();
});

test('applies additional className to the window element', () => {
  renderWindow({ className: 'my-class' });
  expect(document.querySelector('.draggable-window.my-class')).not.toBeNull();
});

test('renders with no className still has draggable-window class', () => {
  renderWindow();
  expect(document.querySelector('.draggable-window')).not.toBeNull();
});

test('starts at the default position', () => {
  const el = renderWindow();
  expect(el.style.left).toBe('300px');
  expect(el.style.top).toBe('100px');
});

test('uses initialPos when provided', () => {
  const el = renderWindow({ initialPos: { x: 500, y: 200 } });
  expect(el.style.left).toBe('500px');
  expect(el.style.top).toBe('200px');
});

test('applies width prop as inline style', () => {
  const el = renderWindow({ width: 240 });
  expect(el.style.width).toBe('240px');
});

// Drag uses clientX/clientY + stored offset.
// mouseDown at (0,0) on default pos (300,100): startX = 0-300=-300, startY = 0-100=-100
// mouseMove to (20,10): x = 20-(-300)=320, y = 10-(-100)=110
test('dragging the titlebar moves the window', () => {
  const el = renderWindow();
  const titlebar = el.querySelector('.titlebar');
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 20, clientY: 10 });
  expect(el.style.left).toBe('320px');
  expect(el.style.top).toBe('110px');
});

test('mouseup stops drag so further moves do not update position', () => {
  const el = renderWindow();
  const titlebar = el.querySelector('.titlebar');
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 10, clientY: 5 });
  fireEvent.mouseUp(document);
  fireEvent.mouseMove(document, { clientX: 60, clientY: 55 });
  expect(el.style.left).toBe('310px');
  expect(el.style.top).toBe('105px');
});

test('titlebar cursor is grabbing while dragging', () => {
  const el = renderWindow();
  const titlebar = el.querySelector('.titlebar');
  expect(titlebar.style.cursor).toBe('move');
  fireEvent.mouseDown(titlebar);
  expect(titlebar.style.cursor).toBe('grabbing');
  fireEvent.mouseUp(document);
  expect(titlebar.style.cursor).toBe('move');
});

test('userSelect is none while dragging', () => {
  const el = renderWindow();
  const titlebar = el.querySelector('.titlebar');
  expect(el.style.userSelect).toBe('');
  fireEvent.mouseDown(titlebar);
  expect(el.style.userSelect).toBe('none');
  fireEvent.mouseUp(document);
  expect(el.style.userSelect).toBe('');
});

test('Reset button returns the window to the initial position', () => {
  const el = renderWindow({ initialPos: { x: 100, y: 50 } });
  const titlebar = el.querySelector('.titlebar');
  // drag away: startX=0-100=-100, startY=0-50=-50; move to (200,150): x=300,y=200
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 200, clientY: 150 });
  fireEvent.mouseUp(document);
  expect(el.style.left).toBe('300px');
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(el.style.left).toBe('100px');
  expect(el.style.top).toBe('50px');
});

test('Move here is enabled when window is on-screen', () => {
  renderWindow();
  expect(screen.getByRole('button', { name: 'Move here' }).disabled).toBe(false);
});

test('Move here is disabled when x is negative', () => {
  const el = renderWindow();
  const titlebar = el.querySelector('.titlebar');
  // drag so x goes negative: startX=350-300=50; move to x=0: pos.x=0-50=-50
  fireEvent.mouseDown(titlebar, { clientX: 350, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 0, clientY: 100 });
  expect(screen.getByRole('button', { name: 'Move here' }).disabled).toBe(true);
});

test('Move here is disabled when y is negative', () => {
  const el = renderWindow();
  const titlebar = el.querySelector('.titlebar');
  // drag so y goes negative: startY=150-100=50; move to y=0: pos.y=0-50=-50
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 150 });
  fireEvent.mouseMove(document, { clientX: 300, clientY: 0 });
  expect(screen.getByRole('button', { name: 'Move here' }).disabled).toBe(true);
});

test('clicking Move here calls onSavePos with current position', () => {
  const onSavePos = vi.fn();
  renderWindow({ onSavePos });
  fireEvent.click(screen.getByRole('button', { name: 'Move here' }));
  expect(onSavePos).toHaveBeenCalledWith({ x: 300, y: 100 });
});

test('clicking Move here calls onClose', () => {
  const onClose = vi.fn();
  render(<DraggableWindow title="T" onClose={onClose} onSavePos={vi.fn()}><div /></DraggableWindow>);
  fireEvent.click(screen.getByRole('button', { name: 'Move here' }));
  expect(onClose).toHaveBeenCalled();
});

test('clicking Move here after dragging saves the new position', () => {
  const onSavePos = vi.fn();
  const el = renderWindow({ onSavePos });
  const titlebar = el.querySelector('.titlebar');
  fireEvent.mouseDown(titlebar, { clientX: 0, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: 50, clientY: 20 });
  fireEvent.mouseUp(document);
  fireEvent.click(screen.getByRole('button', { name: 'Move here' }));
  expect(onSavePos).toHaveBeenCalledWith({ x: 350, y: 120 });
});

test('clicking Move here without onSavePos does not throw', () => {
  renderWindow();
  expect(() => fireEvent.click(screen.getByRole('button', { name: 'Move here' }))).not.toThrow();
});

test('clicking Move here without onClose does not throw', () => {
  render(<DraggableWindow title="T" onSavePos={vi.fn()}><div /></DraggableWindow>);
  expect(() => fireEvent.click(screen.getByRole('button', { name: 'Move here' }))).not.toThrow();
});
