import { useEffect, useRef, useState } from 'react';
import Titlebar from './reuse/Titlebar.jsx';

/**
 * Modal dialog that displays the Moxfield export list and lets the user copy it.
 * The textarea is auto-focused and fully selected on open so Ctrl+C works immediately.
 * Pressing Escape or clicking the backdrop closes the modal.
 * @param {Object} props
 * @param {string} props.text - The formatted export text to display in the textarea.
 * @param {function(): void} props.onClose - Called when the user dismisses the modal.
 */
export default function ExportModal({ text, onClose }) {
  const textareaRef = useRef(null);
  const [copyLabel, setCopyLabel] = useState('Copy');

  // Select everything on open so Ctrl+C works immediately.
  useEffect(() => {
    textareaRef.current.focus();
    textareaRef.current.select();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  /**
   * Copies the export text to the clipboard using the Clipboard API.
   * If the browser blocks clipboard access, falls back to selecting the text and
   * prompting the user to press Ctrl+C manually.
   */
  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel('Copied!');
    } catch {
      textareaRef.current.select();
      setCopyLabel('Press Ctrl+C');
    }
  }

  /**
   * Closes the modal only when the user clicks the dark overlay behind the dialog,
   * not when they click inside the dialog itself.
   * @param {MouseEvent} event - The click event from the modal overlay.
   */
  function closeWhenBackdropClicked(event) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={closeWhenBackdropClicked}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Export to Moxfield">
        <Titlebar>Export to Moxfield</Titlebar>
        <div className="dialog-body">
          <textarea
            ref={textareaRef}
            readOnly
            value={text}
            placeholder="No cards in your collection yet."
          />
          <div className="button-row">
            <button onClick={copyToClipboard}>{copyLabel}</button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
