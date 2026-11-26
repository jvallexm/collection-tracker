import { useEffect, useMemo } from 'react';
import ManaCost from './ManaCost.jsx';
import QuantityCell from './reuse/QuantityCell.jsx';
import SortIndicator from './reuse/SortIndicator.jsx';
import { RARITY_LETTER, VERTICAL_STEP, HORIZONTAL_STEP, formatCKPrice } from '../lib/constants.js';

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

function findNextRowInput(table, currentInput, vStep) {
  const col = currentInput.dataset.col;
  const otherCol = col === 'have' ? 'foil' : 'have';
  const allRows = Array.from(table.querySelectorAll('tr'));
  const currentRowIdx = allRows.indexOf(currentInput.closest('tr'));
  const candidateRows =
    vStep > 0 ? allRows.slice(currentRowIdx + 1) : allRows.slice(0, currentRowIdx).reverse();
  for (const row of candidateRows) {
    const sameColInput = row.querySelector(`input[data-col="${col}"]`);
    if (sameColInput && !sameColInput.disabled) return sameColInput;
    const otherColInput = row.querySelector(`input[data-col="${otherCol}"]`);
    if (otherColInput && !otherColInput.disabled) return otherColInput;
  }
  return null;
}

function moveFocusBetweenInputs(event, onEscapeTop) {
  const key = event.key.toLowerCase();
  const vStep = VERTICAL_STEP[key];
  const hStep = HORIZONTAL_STEP[key];
  if (vStep === undefined && hStep === undefined) return;

  event.preventDefault();
  if (vStep !== undefined) {
    const nextInput = findNextRowInput(event.currentTarget, event.target, vStep);
    if (nextInput) {
      nextInput.focus();
    } else {
      onEscapeTop?.();
    }
  } else {
    const rowInputs = Array.from(event.target.closest('tr').querySelectorAll('input[data-col]'));
    const neighbor = rowInputs[rowInputs.indexOf(event.target) + hStep];
    if (!neighbor) return;
    if (!neighbor.disabled) {
      neighbor.focus();
    } else {
      const allRows = Array.from(event.currentTarget.querySelectorAll('tr'));
      const currentRowIdx = allRows.indexOf(event.target.closest('tr'));
      const targetInputs = Array.from(
        event.currentTarget.querySelectorAll(`input[data-col="${neighbor.dataset.col}"]`),
      ).filter((i) => !i.disabled);
      const next = targetInputs.find((i) => allRows.indexOf(i.closest('tr')) > currentRowIdx);
      if (next) next.focus();
    }
  }
}

function selectInputText(event) {
  event.target.select();
}

function CardRow({
  card,
  entry,
  onQuantityChange,
  onFoilQuantityChange,
  onInputFocus,
  showNumber,
  ckPrices,
  showCKTools,
  showSetColumn,
}) {
  const ckEntry = ckPrices?.get(card.id);
  return (
    <tr data-card-id={card.id}>
      <QuantityCell
        col="have"
        label={`Copies of ${card.name}`}
        value={entry?.qty || ''}
        onFocus={(e) => {
          selectInputText(e);
          onInputFocus?.(card, false);
        }}
        onChange={(e) => onQuantityChange(card.id, e.target.value)}
        disabled={!card.nonfoil}
      />
      <QuantityCell
        col="foil"
        label={`Foil copies of ${card.name}`}
        value={entry?.foil || ''}
        onFocus={(e) => {
          selectInputText(e);
          onInputFocus?.(card, true);
        }}
        onChange={(e) => onFoilQuantityChange(card.id, e.target.value)}
        disabled={!card.foil}
      />
      {showSetColumn && <td className="cost-cell">{card.set}</td>}
      <td>
        {card.name}
        {showNumber && <i className="card-number-disambig"> ({card.number})</i>}
        {card.reserved && <span className="rl-badge">RL</span>}
      </td>
      <td>{RARITY_LETTER[card.rarity]}</td>
      <td className="cost-cell">
        <ManaCost cost={card.cost} />
      </td>
      <td className="number-cell">{card.number}</td>
      <td className="price-cell">{formatPrice(card.price)}</td>
      <td className="price-cell">{formatPrice(card.priceFoil)}</td>
      {showCKTools && <td className="price-cell ck-cell">{formatCKPrice(ckEntry?.nonfoilBuy)}</td>}
      {showCKTools && <td className="price-cell ck-cell">{formatCKPrice(ckEntry?.foilBuy)}</td>}
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
  ckPrices = null,
  showCKTools = true,
  showSetColumn = false,
}) {
  useEffect(() => {
    const focused = document.activeElement;
    if (focused?.classList.contains('qty-input')) {
      focused.scrollIntoView({ block: 'nearest' });
    }
  }, [cards]);

  const duplicateNames = useMemo(() => {
    const counts = new Map();
    for (const card of [...cards, ...tokenCards])
      counts.set(card.name, (counts.get(card.name) ?? 0) + 1);
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
            {showSetColumn && (
              <th className="cost-cell" onClick={() => onSort('set')}>
                Set
                <SortIndicator active={sort.key === 'set'} direction={sort.direction} />
              </th>
            )}
            {COLUMNS.map(({ key, label, className }) => (
              <th key={key} className={className} onClick={() => onSort(key)}>
                {label}
                <SortIndicator active={sort.key === key} direction={sort.direction} />
              </th>
            ))}
            {showCKTools && <th className="price-cell ck-cell">CK</th>}
            {showCKTools && <th className="price-cell ck-cell">CKF</th>}
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
              ckPrices={ckPrices}
              showCKTools={showCKTools}
              showSetColumn={showSetColumn}
            />
          ))}
          {tokenCards.length > 0 && (
            <>
              <tr className="token-section-heading">
                <td colSpan={2 + COLUMNS.length + (showCKTools ? 2 : 0) + (showSetColumn ? 1 : 0)}>
                  Tokens
                </td>
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
                  ckPrices={ckPrices}
                  showCKTools={showCKTools}
                  showSetColumn={showSetColumn}
                />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
