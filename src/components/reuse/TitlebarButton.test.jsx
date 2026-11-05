import { fireEvent, render, screen } from '@testing-library/react';
import TitlebarButton from './TitlebarButton.jsx';

test('renders a button with the given aria-label', () => {
  render(<TitlebarButton label="Close" iconClass="close-icon" onClick={() => {}} />);
  expect(screen.getByRole('button', { name: 'Close' })).not.toBeNull();
});

test('renders an icon span with the given class', () => {
  const { container } = render(
    <TitlebarButton label="Close" iconClass="close-icon" onClick={() => {}} />,
  );
  expect(container.querySelector('.close-icon')).not.toBeNull();
});

test('calls onClick when clicked', () => {
  const onClick = vi.fn();
  render(<TitlebarButton label="Close" iconClass="close-icon" onClick={onClick} />);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onClick).toHaveBeenCalledTimes(1);
});
