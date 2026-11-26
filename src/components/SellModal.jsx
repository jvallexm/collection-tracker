import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CardPreview from './CardPreview.jsx';
import ManaCost from './ManaCost.jsx';
import Titlebar from './reuse/Titlebar.jsx';
import TitlebarButton from './reuse/TitlebarButton.jsx';
import { buildCKSellCsv } from '../lib/cardkingdom.js';
import { fetchCardsByIds } from '../lib/scryfall.js';
import {
  loadAllCollectionKeys,
  loadCards,
  loadCollection,
  loadConfig,
  loadPartialCards,
  saveConfig,
  savePartialCards,
} from '../lib/storage.js';
import { mergeCollections } from '../lib/collection.js';
import { useEscapeToClose } from '../lib/hooks.js';
import { RARITY_LETTER, VERTICAL_STEP, HORIZONTAL_STEP, formatCKPrice } from '../lib/constants.js';

function moveSellFocus(event) {
  const key = event.key.toLowerCase();
  const vStep = VERTICAL_STEP[key];
  const hStep = HORIZONTAL_STEP[key];
  if (vStep === undefined && hStep === undefined) return;

  event.preventDefault();
  const col = event.target.dataset.col;
  const currentRow = event.target.closest('tr');

  if (vStep !== undefined) {
    let row = vStep > 0 ? currentRow.nextElementSibling : currentRow.previousElementSibling;
    while (row) {
      const input = row.querySelector(`input[data-col="${col}"]`);
      if (input && !input.disabled) {
        input.focus();
        return;
      }
      row = vStep > 0 ? row.nextElementSibling : row.previousElementSibling;
    }
  } else {
    const rowInputs = Array.from(currentRow.querySelectorAll('input[data-col]'));
    const neighbor = rowInputs[rowInputs.indexOf(event.target) + hStep];
    if (!neighbor) return;
    if (!neighbor.disabled) {
      neighbor.focus();
    } else {
      let row = currentRow.nextElementSibling;
      while (row) {
        const input = row.querySelector(`input[data-col="${neighbor.dataset.col}"]`);
        if (input && !input.disabled) {
          input.focus();
          return;
        }
        row = row.nextElementSibling;
      }
    }
  }
}

function SellQtyInput({ label, col, value, max, onChange, onFocus }) {
  return (
    <input
      className="qty-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      data-lpignore="true"
      aria-label={label}
      data-col={col}
      value={value || ''}
      disabled={max === 0}
      onFocus={(e) => {
        e.target.select();
        onFocus?.();
      }}
      onKeyDown={(e) => {
        if (e.key === '`') {
          e.preventDefault();
          onChange(max);
        }
      }}
      onChange={(e) => onChange(Math.min(parseInt(e.target.value, 10) || 0, max))}
    />
  );
}

const SellRow = memo(function SellRow({
  card,
  entry,
  setName,
  sellQty,
  foilSellQty,
  onSellChange,
  onFoilSellChange,
  onFocus,
  ckPrices,
}) {
  const qty = entry?.qty ?? 0;
  const foil = entry?.foil ?? 0;
  const ckEntry = ckPrices?.get(card.id);
  return (
    <tr>
      <td className="qty-cell">{qty || ''}</td>
      <td className="qty-cell">
        <SellQtyInput
          label={`Sell ${card.name}`}
          col="sell"
          value={sellQty}
          max={qty}
          onChange={(v) => onSellChange(card.id, v)}
          onFocus={() => onFocus?.(card, false)}
        />
      </td>
      {ckPrices && <td className="price-cell ck-cell">{formatCKPrice(ckEntry?.nonfoilBuy)}</td>}
      <td className="qty-cell">{foil || ''}</td>
      <td className="qty-cell">
        <SellQtyInput
          label={`Foil sell ${card.name}`}
          col="foil-sell"
          value={foilSellQty}
          max={card.foil ? foil : 0}
          onChange={(v) => onFoilSellChange(card.id, v)}
          onFocus={() => onFocus?.(card, true)}
        />
      </td>
      {ckPrices && <td className="price-cell ck-cell">{formatCKPrice(ckEntry?.foilBuy)}</td>}
      <td className="cost-cell">{setName?.toUpperCase()}</td>
      <td>
        {card.name}
        {card.reserved && <span className="rl-badge">RL</span>}
      </td>
      <td>{RARITY_LETTER[card.rarity]}</td>
      <td className="cost-cell">
        <ManaCost cost={card.cost} />
      </td>
      <td className="number-cell">{card.number}</td>
    </tr>
  );
});

export default function SellModal({
  onClose,
  openSets = [],
  ckPrices = null,
  cardPreviewPos = null,
  cardImageSize = null,
}) {
  const [allCards, setAllCards] = useState(null);
  const [focusedCard, setFocusedCard] = useState(null);
  const [focusedCardIsFoil, setFocusedCardIsFoil] = useState(false);
  const [collections, setCollections] = useState({});
  const [cardSetMap, setCardSetMap] = useState({});
  const [sellQtys, setSellQtys] = useState({});
  const [foilSellQtys, setFoilSellQtys] = useState({});
  const sellQtysReady = useRef(false);
  const foilSellQtysReady = useRef(false);

  useEffect(() => {
    (async () => {
      const storedKeys = await loadAllCollectionKeys();
      const openCodes = openSets.map((s) => s.code);
      const allCodes = [...new Set([...storedKeys, ...openCodes])];
      const cardAccum = [];
      const collectionAccum = {};
      const indexAccum = {};

      // Load collections first to know which card IDs are owned
      for (const code of allCodes) {
        collectionAccum[code] = await loadCollection(code);
      }
      const ownedIds = new Set(
        Object.values(collectionAccum).flatMap((coll) =>
          Object.entries(coll)
            .filter(([, e]) => (e?.qty ?? 0) > 0 || (e?.foil ?? 0) > 0)
            .map(([id]) => id),
        ),
      );

      // Use per-set IDB cache when available; collect uncached owned IDs for batch fetch
      const uncachedIds = [];
      for (const code of allCodes) {
        const cached = (await loadCards(code)) ?? (await loadPartialCards(code));
        if (cached) {
          for (const card of cached) {
            if (ownedIds.has(card.id) && !indexAccum[card.id]) {
              indexAccum[card.id] = code;
              cardAccum.push(card);
            }
          }
        } else {
          for (const id of Object.keys(collectionAccum[code])) {
            if (ownedIds.has(id) && !indexAccum[id]) uncachedIds.push(id);
          }
        }
      }

      // Batch fetch only the owned cards that weren't in IDB; cache results for future opens
      if (uncachedIds.length > 0) {
        const fetched = await fetchCardsByIds(uncachedIds).catch(() => []);
        const bySet = {};
        for (const card of fetched) {
          if (!indexAccum[card.id]) {
            indexAccum[card.id] = card.set.toLowerCase();
            cardAccum.push(card);
          }
          (bySet[card.set.toLowerCase()] ??= []).push(card);
        }
        for (const [code, cards] of Object.entries(bySet)) {
          savePartialCards(code, cards);
        }
      }
      cardAccum.sort(
        (a, b) => indexAccum[a.id].localeCompare(indexAccum[b.id]) || a.name.localeCompare(b.name),
      );
      setAllCards(cardAccum);
      setCollections(collectionAccum);
      setCardSetMap(indexAccum);
    })();
  }, []);

  useEffect(() => {
    loadConfig('sellQtys').then((saved) => {
      sellQtysReady.current = true;
      if (saved) setSellQtys(saved);
    });
    loadConfig('foilSellQtys').then((saved) => {
      foilSellQtysReady.current = true;
      if (saved) setFoilSellQtys(saved);
    });
  }, []);

  useEffect(() => {
    if (sellQtysReady.current) saveConfig('sellQtys', sellQtys);
  }, [sellQtys]);

  useEffect(() => {
    if (foilSellQtysReady.current) saveConfig('foilSellQtys', foilSellQtys);
  }, [foilSellQtys]);

  useEscapeToClose(onClose);

  const handleFocus = useCallback((card, isFoil) => {
    setFocusedCard(card);
    setFocusedCardIsFoil(isFoil);
  }, []);

  const handleSellChange = useCallback(
    (cardId, v) => setSellQtys((prev) => ({ ...prev, [cardId]: v })),
    [],
  );
  const handleFoilSellChange = useCallback(
    (cardId, v) => setFoilSellQtys((prev) => ({ ...prev, [cardId]: v })),
    [],
  );

  const mergedCollection = useMemo(() => mergeCollections(collections), [collections]);

  const ownedCards = useMemo(() => {
    if (allCards === null) return null;
    return allCards.filter((card) => {
      const entry = mergedCollection[card.id];
      return (entry?.qty ?? 0) > 0 || (entry?.foil ?? 0) > 0;
    });
  }, [allCards, mergedCollection]);

  const ckTotal = useMemo(() => {
    if (!ownedCards || !ckPrices) return null;
    let sum = 0;
    for (const card of ownedCards) {
      const entry = ckPrices.get(card.id);
      if (!entry) continue;
      const qty = sellQtys[card.id] ?? 0;
      const foil = foilSellQtys[card.id] ?? 0;
      if (qty > 0 && entry.nonfoilBuy) sum += qty * entry.nonfoilBuy;
      if (foil > 0 && entry.foilBuy) sum += foil * entry.foilBuy;
    }
    return sum;
  }, [ownedCards, ckPrices, sellQtys, foilSellQtys]);

  function handleExport() {
    const setNames = {};
    for (const s of openSets) setNames[s.code] = s.name;

    const setCodesUsed = [...new Set(Object.values(cardSetMap))];
    const setsData = setCodesUsed.map((code) => {
      const sellCollection = {};
      for (const card of ownedCards) {
        if (cardSetMap[card.id] !== code) continue;
        const qty = sellQtys[card.id] ?? 0;
        const foil = foilSellQtys[card.id] ?? 0;
        if (qty > 0 || foil > 0) sellCollection[card.id] = { qty, foil };
      }
      return { setName: setNames[code] ?? code, cards: ownedCards, sellCollection };
    });

    const csv = buildCKSellCsv(setsData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sell-to-cardkingdom.csv';
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  }

  function closeWhenBackdropClicked(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <>
      <div className="modal-overlay" onClick={closeWhenBackdropClicked}>
        <div
          className="dialog dialog--wide"
          role="dialog"
          aria-modal="true"
          aria-label="Sell to Card Kingdom"
        >
          <Titlebar>
            <span>Sell to Card Kingdom</span>
            <div className="titlebar-buttons">
              <TitlebarButton label="Close" iconClass="close-icon" onClick={onClose} />
            </div>
          </Titlebar>
          <div className="dialog-body">
            <div className="button-row">
              <button onClick={handleExport}>Export</button>
              {ckTotal !== null && (
                <span className="ck-total">CK total: ${ckTotal.toFixed(2)}</span>
              )}
            </div>
            {ownedCards === null ? (
              <div className="table-scroll table-loading">
                <span className="loading-spinner" aria-label="Loading" />
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th className="qty-heading">Qty</th>
                      <th className="qty-heading">Sell</th>
                      {ckPrices && <th className="price-cell ck-cell">CK</th>}
                      <th className="qty-heading">Foil</th>
                      <th className="qty-heading">Foil Sell</th>
                      {ckPrices && <th className="price-cell ck-cell">CKF</th>}
                      <th className="cost-cell">Set</th>
                      <th>Name</th>
                      <th>R</th>
                      <th className="cost-cell">Cost</th>
                      <th className="number-cell">#</th>
                    </tr>
                  </thead>
                  <tbody onKeyDown={moveSellFocus}>
                    {ownedCards.map((card) => (
                      <SellRow
                        key={card.id}
                        card={card}
                        entry={mergedCollection[card.id]}
                        setName={cardSetMap[card.id]}
                        sellQty={sellQtys[card.id] ?? 0}
                        foilSellQty={foilSellQtys[card.id] ?? 0}
                        onSellChange={handleSellChange}
                        onFoilSellChange={handleFoilSellChange}
                        onFocus={handleFocus}
                        ckPrices={ckPrices}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      <CardPreview
        card={focusedCard}
        pos={cardPreviewPos}
        imageSize={cardImageSize ?? 'small'}
        isFoil={focusedCardIsFoil}
      />
    </>
  );
}
