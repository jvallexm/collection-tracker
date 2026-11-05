import { render, screen } from '@testing-library/react';
import Titlebar from './Titlebar.jsx';

test('renders children inside a .titlebar div', () => {
  const { container } = render(<Titlebar>My Window</Titlebar>);
  expect(container.querySelector('.titlebar').textContent).toBe('My Window');
});

test('renders complex children', () => {
  render(
    <Titlebar>
      <span>Title</span>
      <button>X</button>
    </Titlebar>,
  );
  expect(screen.getByText('Title')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'X' })).not.toBeNull();
});
