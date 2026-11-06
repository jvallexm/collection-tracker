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

test('uses CSS default position when no pos is given', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} />);
  const el = document.querySelector('.card-preview');
  expect(el.style.left).toBe('');
  expect(el.style.top).toBe('');
  expect(el.style.width).toBe('160px');
});

test('overrides position when pos prop is provided', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} pos={{ x: 400, y: 150 }} />);
  const el = document.querySelector('.card-preview');
  expect(el.style.left).toBe('400px');
  expect(el.style.top).toBe('150px');
});

test('defaults to small version in image URL', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} />);
  expect(screen.getByAltText('Arrow').getAttribute('src')).toContain('version=small');
});

test('uses provided imageSize in image URL', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} imageSize="normal" />);
  expect(screen.getByAltText('Arrow').getAttribute('src')).toContain('version=normal');
});

test('widens the container for normal size', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} imageSize="normal" />);
  expect(document.querySelector('.card-preview').style.width).toBe('230px');
});

test('widens the container for large size', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} imageSize="large" />);
  expect(document.querySelector('.card-preview').style.width).toBe('300px');
});

test('shows no foil overlay by default', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} />);
  expect(document.querySelector('.card-preview-foil-overlay')).toBeNull();
});

test('shows foil overlay when isFoil is true', () => {
  render(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} isFoil={true} />);
  expect(document.querySelector('.card-preview-foil-overlay')).not.toBeNull();
});

test('resets loading spinner when imageSize changes', async () => {
  const { rerender } = render(
    <CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} imageSize="small" />,
  );
  fireEvent.load(screen.getByAltText('Arrow'));
  expect(screen.queryByRole('status')).toBeNull();
  rerender(<CardPreview card={makeCard({ id: 'abc-123', name: 'Arrow' })} imageSize="normal" />);
  expect(screen.getByRole('status')).not.toBeNull();
});
