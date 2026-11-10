import { CARD_IMAGE_SIZES } from '../../lib/constants.js';

export default function SizeControls({ imageSize, onSizeChange }) {
  return (
    <div className="draggable-preview-resize">
      <span className="draggable-preview-resize-label">Resize preview</span>
      <div className="draggable-preview-size-btns">
        {CARD_IMAGE_SIZES.map((size, i) => (
          <button
            key={size}
            className="titlebar-btn"
            aria-label={`${size} size`}
            aria-pressed={imageSize === size}
            onClick={() => onSizeChange(size)}
          >
            <span className={`size-box size-box--${i}`} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
