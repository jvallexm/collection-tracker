import { useState } from 'react';
import DraggableWindow from './reuse/DraggableWindow.jsx';
import SizeControls from './reuse/SizeControls.jsx';
import { CARD_IMAGE_WIDTHS } from '../lib/constants.js';

const CARD_NAME = 'Cut // Ribbons';

function imageUrl(size) {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(CARD_NAME)}&set=sld&format=image&version=${size}`;
}

export default function DraggableCardPreview({ onClose, initialPos = null, onSavePos, initialImageSize = 'small', onSaveSize }) {
  const [loading, setLoading] = useState(true);
  const [imageSize, setImageSize] = useState(initialImageSize);

  function handleSizeChange(size) {
    setImageSize(size);
    setLoading(true);
    onSaveSize?.(size);
  }

  return (
    <DraggableWindow
      title={CARD_NAME}
      initialPos={initialPos ?? undefined}
      onSavePos={onSavePos}
      onClose={onClose}
      width={CARD_IMAGE_WIDTHS[imageSize]}
      className="card-preview draggable-preview"
      controls={<SizeControls imageSize={imageSize} onSizeChange={handleSizeChange} />}
    >
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
    </DraggableWindow>
  );
}
