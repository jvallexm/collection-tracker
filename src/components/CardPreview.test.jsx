import { fireEvent, render, screen } from '@testing-library/react';
import { makeCard } from '../test/fixtures.js';
import CardPreview from './CardPreview.jsx';

test('renders nothing when card is null', () => {
  render(<CardPreview card={null} />);
  expect(screen.queryByRole('img')).toBeNull();
});

test('shows a loading indicator while the image has not yet loaded', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} />);
  expect(screen.getByRole('status')).not.toBeNull();
});

test('hides the loading indicator once the image loads', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} />);
  fireEvent.load(screen.getByAltText('Arrow'));
  expect(screen.queryByRole('status')).toBeNull();
});

test('shows the card image with the card id in the src', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} />);
  expect(screen.getByAltText('Arrow').getAttribute('src')).toContain('abc-123');
});

test('uses the card name as alt text', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} />);
  expect(screen.getByAltText('Arrow')).not.toBeNull();
});

test('shows the card name in the title bar', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} />);
  expect(screen.getByText('Arrow')).not.toBeNull();
});
