import { useEffect, useMemo } from 'react';
import ManaCost from './ManaCost.jsx';
import QuantityCell from './reuse/QuantityCell.jsx';
import SortIndicator from './reuse/SortIndicator.jsx';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'rarity', label: 'R' },
  { key: 'cost', label: 'Cost', className: 'cost-cell' },
  { key: 'number', label: '#', className: 'number-cell' },
  { key: 'price', label: '$', className: 'price-cell' },
  { key: 'priceFoil', label: '$F', className: 'price-cell' },
];

function formatPrice(p) {
  if (p == null) return '—';
  const num = parseFloat(p);
  return num < 10 ? `$${p}` : `$${Math.floor(num)}`;
}

const VERTICAL_STEP = { w: -1, arrowup: -1, s: 1, arrowdown: 1, enter: 1 };
const HORIZONTAL_STEP = { a: -1, arrowleft: -1, d: 1, arrowright: 1 };

const RARITY_LETTER = { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M' };

function moveFocusBetweenInputs(event, onEscapeTop) {
  const key = event.key.toLowerCase();
  const vStep = VERTICAL_STEP[key];
  const hStep = HORIZONTAL_STEP[key];
  if (vStep === undefined && hStep === undefined) return;

  event.preventDefault();
  if (vStep !== undefined) {
    const col = event.target.dataset.col;
    const colInputs = Array.from(event.currentTarget.querySelectorAll(`input[data-col="${col}"]`)).filter((i) => !i.disabled);
    const idx = colInputs.indexOf(event.target);
    if (idx + vStep < 0) {
      onEscapeTop?.();
      return;
    }
    const neighbor = colInputs[idx + vStep];
    if (neighbor) neighbor.focus();
  } else {
    const rowInputs = Array.from(event.target.closest('tr').querySelectorAll('input'));
    const neighbor = rowInputs[rowInputs.indexOf(event.target) + hStep];
    if (neighbor) neighbor.focus();
  }
}

function selectInputText(event) {
  event.target.select();
}

function CardRow({ card, entry, onQuantityChange, onFoilQuantityChange, onInputFocus, showNumber }) {
  return (
    <tr data-card-id={card.id}>
      <QuantityCell
        col="have"
        label={`Copies of ${card.name}`}
        value={entry?.qty || ''}
        onFocus={(e) => { selectInputText(e); onInputFocus?.(card, false); }}
        onChange={(e) => onQuantityChange(card.id, e.target.value)}
        disabled={!card.nonfoil}
      />
      <QuantityCell
        col="foil"
        label={`Foil copies of ${card.name}`}
        value={entry?.foil || ''}
        onFocus={(e) => { selectInputText(e); onInputFocus?.(card, true); }}
        onChange={(e) => onFoilQuantityChange(card.id, e.target.value)}
        disabled={!card.foil}
      />
      <td>
        {card.name}
        {showNumber && <i className="card-number-disambig"> ({card.number})</i>}
        {card.reserved && <span className="rl-badge">RL</span>}
      </td>
      <td>{RARITY_LETTER[card.rarity]}</td>
      <td className="cost-cell"><ManaCost cost={card.cost} /></td>
      <td className="number-cell">{card.number}</td>
      <td className="price-cell">{formatPrice(card.price)}</td>
      <td className="price-cell">{formatPrice(card.priceFoil)}</td>
    </tr>
  );
}

export default function CardTable({
  cards,
  tokenCards = [],
  collection,
  sort = { key: 'name', direction: 1 },
  onQuantityChange,
  onFoilQuantityChange,
  onSort,
  onInputFocus,
  onTableBlur,
  onEscapeTop,
}) {
  useEffect(() => {
    const focused = document.activeElement;
    if (focused?.classList.contains('qty-input')) {
      focused.scrollIntoView({ block: 'nearest' });
    }
  }, [cards]);

  const duplicateNames = useMemo(() => {
    const counts = new Map();
    for (const card of [...cards, ...tokenCards]) counts.set(card.name, (counts.get(card.name) ?? 0) + 1);
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name));
  }, [cards, tokenCards]);

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="qty-heading" onClick={() => onSort('have')}>
              Qty
              <SortIndicator active={sort.key === 'have'} direction={sort.direction} />
            </th>
            <th className="qty-heading">Foil</th>
            {COLUMNS.map(({ key, label, className }) => (
              <th key={key} className={className} onClick={() => onSort(key)}>
                {label}
                <SortIndicator active={sort.key === key} direction={sort.direction} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          onKeyDown={(e) => moveFocusBetweenInputs(e, onEscapeTop)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) onTableBlur?.();
          }}
        >
          {cards.map((card) => (
            <CardRow
              key={card.id}
              card={card}
              entry={collection[card.id]}
              onQuantityChange={onQuantityChange}
              onFoilQuantityChange={onFoilQuantityChange}
              onInputFocus={onInputFocus}
              showNumber={duplicateNames.has(card.name)}
            />
          ))}
          {tokenCards.length > 0 && (
            <>
              <tr className="token-section-heading">
                <td colSpan={8}>Tokens</td>
              </tr>
              {tokenCards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  entry={collection[card.id]}
                  onQuantityChange={onQuantityChange}
                  onFoilQuantityChange={onFoilQuantityChange}
                  onInputFocus={onInputFocus}
                  showNumber={duplicateNames.has(card.name)}
                />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
