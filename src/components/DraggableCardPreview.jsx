import { useEffect, useState } from 'react';
import TitlebarButton from './reuse/TitlebarButton.jsx';

const CARD_NAME = 'Cut // Ribbons';
const DEFAULT_POS = { x: 300, y: 100 };
const SIZES = ['small', 'normal', 'large'];
const SIZE_WIDTHS = { small: 160, normal: 230, large: 300 };

function imageUrl(size) {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(CARD_NAME)}&set=sld&format=image&version=${size}`;
}

export default function DraggableCardPreview({ onClose, initialPos = null, onSavePos, initialImageSize = 'small', onSaveSize }) {
  const [pos, setPos] = useState(initialPos ?? DEFAULT_POS);
  // null = not dragging; { startX, startY } = mouse offset from window origin when drag started
  const [drag, setDrag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageSize, setImageSize] = useState(initialImageSize);

  useEffect(() => {
    if (!drag) return;
    function onMove(e) {
      setPos({ x: e.clientX - drag.startX, y: e.clientY - drag.startY });
    }
    function onUp() {
      setDrag(null);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [drag]);

  function handleTitlebarMouseDown(e) {
    setDrag({ startX: e.clientX - pos.x, startY: e.clientY - pos.y });
  }

  function handleSizeChange(size) {
    setImageSize(size);
    setLoading(true);
    onSaveSize?.(size);
  }

  return (
    <div
      className="card-preview window draggable-preview"
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 200, userSelect: drag ? 'none' : undefined, width: SIZE_WIDTHS[imageSize] }}
    >
      <div
        className="titlebar"
        style={{ cursor: drag ? 'grabbing' : 'move' }}
        onMouseDown={handleTitlebarMouseDown}
      >
        <span>{CARD_NAME}</span>
        <div className="titlebar-buttons">
          <TitlebarButton label="Close" iconClass="close-icon" onClick={onClose} />
        </div>
      </div>
      <div className="card-preview-body">
        {loading && <div role="status" className="card-preview-loading">⌛</div>}
        <img
          key={imageSize}
          src={imageUrl(imageSize)}
          alt={CARD_NAME}
          style={loading ? { display: 'none' } : undefined}
          onLoad={() => setLoading(false)}
        />
      </div>
      <div className="draggable-preview-footer">
        <div className="draggable-preview-resize">
          <span className="draggable-preview-resize-label">Resize preview</span>
          <div className="draggable-preview-size-btns">
            {SIZES.map((size, i) => (
              <button
                key={size}
                className="titlebar-btn"
                aria-label={`${size} size`}
                aria-pressed={imageSize === size}
                onClick={() => handleSizeChange(size)}
              >
                <span className={`size-box size-box--${i}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <div className="draggable-preview-pos-btns">
          <button
            className="draggable-preview-reset-btn"
            onClick={() => setPos(DEFAULT_POS)}
          >
            Reset
          </button>
          <button
            className="draggable-preview-move-btn"
            disabled={pos.x < 0 || pos.y < 0}
            onClick={() => { onSavePos?.(pos); onClose?.(); }}
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}
