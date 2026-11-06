import { useEffect, useState } from 'react';
import Titlebar from './reuse/Titlebar.jsx';

export default function CardPreview({ card, pos = null, imageSize = 'small', isFoil = false }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(true); }, [imageSize]);

  if (!card) return null;

  const SIZE_WIDTHS = { small: 160, normal: 230, large: 300 };
  const style = {
    ...(pos ? { left: pos.x, top: pos.y } : {}),
    width: SIZE_WIDTHS[imageSize],
  };

  return (
    <div className="card-preview window" style={style}>
      <Titlebar>{card.name}</Titlebar>
      <div className="card-preview-body">
        {loading && (
          <div role="status" className="card-preview-loading">
            ⌛
          </div>
        )}
        <img
          key={imageSize}
          src={`https://api.scryfall.com/cards/${card.id}?format=image&version=${imageSize}`}
          alt={card.name}
          style={loading ? { display: 'none' } : undefined}
          onLoad={() => setLoading(false)}
        />
        {isFoil && <div className="card-preview-foil-overlay" aria-hidden="true" />}
      </div>
    </div>
  );
}
