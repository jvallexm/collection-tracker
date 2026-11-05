import { fireEvent, render, screen } from '@testing-library/react';
import ExportModal from './ExportModal.jsx';

const TEXT = '1 Arrow (KTK) 3\n2 Bolt (KTK) 7';

function renderModal() {
  const onClose = vi.fn();
  const view = render(<ExportModal text={TEXT} onClose={onClose} />);
  return { onClose, ...view };
}

const stubClipboard = (writeText) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

describe('ExportModal', () => {
  test('shows the list with everything selected', () => {
    renderModal();
    const textarea = screen.getByRole('textbox');
    expect(textarea.value).toBe(TEXT);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(TEXT.length);
  });

  test('closes with the Close button', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('closes when Escape is pressed, but not for other keys', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('stops listening for Escape after it unmounts', () => {
    const { onClose, unmount } = renderModal();
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  test('closes when the backdrop is clicked, but not the dialog itself', () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog.parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('copies the list to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue();
    stubClipboard(writeText);
    renderModal();

    fireEvent.click(screen.getByText('Copy'));

    expect(await screen.findByText('Copied!')).not.toBeNull();
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  test('asks the user to copy manually when the clipboard is blocked', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    renderModal();

    fireEvent.click(screen.getByText('Copy'));

    expect(await screen.findByText('Press Ctrl+C')).not.toBeNull();
  });
});
