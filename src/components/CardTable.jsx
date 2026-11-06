import { useEffect } from 'react';
import ManaCost from './ManaCost.jsx';
import QuantityCell from './reuse/QuantityCell.jsx';
import SortIndicator from './reuse/SortIndicator.jsx';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'rarity', label: 'R' },
  { key: 'cost', label: 'Cost', className: 'cost-cell' },
  { key: 'number', label: '#', className: 'number-cell' },
];

const VERTICAL_STEP = { w: -1, arrowup: -1, s: 1, arrowdown: 1, enter: 1 };
const HORIZONTAL_STEP = { a: -1, arrowleft: -1, d: 1, arrowright: 1 };

const RARITY_LETTER = { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M' };

function moveFocusBetweenInputs(event) {
  const key = event.key.toLowerCase();
  const vStep = VERTICAL_STEP[key];
  const hStep = HORIZONTAL_STEP[key];
  if (vStep === undefined && hStep === undefined) return;

  event.preventDefault();
  if (vStep !== undefined) {
    const col = event.target.dataset.col;
    const colInputs = Array.from(event.currentTarget.querySelectorAll(`input[data-col="${col}"]`));
    const neighbor = colInputs[colInputs.indexOf(event.target) + vStep];
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
}) {
  useEffect(() => {
    const focused = document.activeElement;
    if (focused?.classList.contains('qty-input')) {
      focused.scrollIntoView({ block: 'nearest' });
    }
  }, [cards]);

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
          onKeyDown={moveFocusBetweenInputs}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) onTableBlur?.();
          }}
        >
          {cards.map((card) => {
            const entry = collection[card.id];
            return (
              <tr key={card.id} data-card-id={card.id}>
                <QuantityCell
                  col="have"
                  label={`Copies of ${card.name}`}
                  value={entry?.qty || ''}
                  onFocus={(e) => {
                    selectInputText(e);
                    onInputFocus?.(card);
                  }}
                  onChange={(e) => onQuantityChange(card.id, e.target.value)}
                />
                <QuantityCell
                  col="foil"
                  label={`Foil copies of ${card.name}`}
                  value={entry?.foil || ''}
                  onFocus={(e) => {
                    selectInputText(e);
                    onInputFocus?.(card);
                  }}
                  onChange={(e) => onFoilQuantityChange(card.id, e.target.value)}
                />
                <td>{card.name}</td>
                <td>{RARITY_LETTER[card.rarity]}</td>
                <td className="cost-cell">
                  <ManaCost cost={card.cost} />
                </td>
                <td className="number-cell">{card.number}</td>
              </tr>
            );
          })}
          {tokenCards.length > 0 && (
            <>
              <tr className="token-section-heading">
                <td colSpan={6}>Tokens</td>
              </tr>
              {tokenCards.map((card) => {
                const entry = collection[card.id];
                return (
                  <tr key={card.id} data-card-id={card.id}>
                    <QuantityCell
                      col="have"
                      label={`Copies of ${card.name}`}
                      value={entry?.qty || ''}
                      onFocus={(e) => { selectInputText(e); onInputFocus?.(card); }}
                      onChange={(e) => onQuantityChange(card.id, e.target.value)}
                    />
                    <QuantityCell
                      col="foil"
                      label={`Foil copies of ${card.name}`}
                      value={entry?.foil || ''}
                      onFocus={(e) => { selectInputText(e); onInputFocus?.(card); }}
                      onChange={(e) => onFoilQuantityChange(card.id, e.target.value)}
                    />
                    <td>{card.name}</td>
                    <td>{RARITY_LETTER[card.rarity]}</td>
                    <td className="cost-cell"><ManaCost cost={card.cost} /></td>
                    <td className="number-cell">{card.number}</td>
                  </tr>
                );
              })}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
