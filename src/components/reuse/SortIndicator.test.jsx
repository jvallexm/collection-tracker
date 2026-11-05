import { render } from '@testing-library/react';
import SortIndicator from './SortIndicator.jsx';

test('renders nothing when inactive', () => {
  const { container } = render(<SortIndicator active={false} direction={1} />);
  expect(container.firstChild).toBeNull();
});

test('renders ▲ when active and direction is 1', () => {
  const { container } = render(<SortIndicator active={true} direction={1} />);
  expect(container.textContent).toContain('▲');
});

test('renders ▼ when active and direction is -1', () => {
  const { container } = render(<SortIndicator active={true} direction={-1} />);
  expect(container.textContent).toContain('▼');
});

test('has aria-hidden', () => {
  const { container } = render(<SortIndicator active={true} direction={1} />);
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
});
