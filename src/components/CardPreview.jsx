import { useState } from 'react';
import Titlebar from './reuse/Titlebar.jsx';

/**
 * Floating card image preview shown when a quantity input is focused.
 * @param {Object} props
 * @param {Object|null} props.card - Card to preview, or null to render nothing.
 */
export default function CardPreview({ card }) {
  const [loading, setLoading] = useState(true);

  if (!card) return null;

  return (
    <div className="card-preview window">
      <Titlebar>{card.name}</Titlebar>
      <div className="card-preview-body">
        {loading && (
          <div role="status" className="card-preview-loading">
            ⌛
          </div>
        )}
        <img
          src={`https://api.scryfall.com/cards/${card.id}?format=image&version=small`}
          alt={card.name}
          style={loading ? { display: 'none' } : undefined}
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
