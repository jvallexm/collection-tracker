import { act, screen } from '@testing-library/react';

test('mounts the app into the #root element', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // never finishes loading

  await import('./main.jsx');

  expect(await screen.findByText('Khans of Tarkir - Collection')).not.toBeNull();
  await act(async () => {}); // flush async IDB collection load
});
