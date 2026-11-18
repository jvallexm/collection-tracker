import { useEffect, useMemo, useState } from 'react';
import ManaCost from './ManaCost.jsx';
import Titlebar from './reuse/Titlebar.jsx';
import TitlebarButton from './reuse/TitlebarButton.jsx';
import { buildCKSellCsv } from '../lib/cardkingdom.js';
import { loadAllCollectionKeys, loadCards, loadCollection } from '../lib/storage.js';

const RARITY_LETTER = { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M' };

function formatCKPrice(p) {
  if (p == null || p <= 0) return '';
  return `$${Number(p).toFixed(2)}`;
}

function SellQtyInput({ label, value, max, onChange }) {
  return (
    <input
      className="qty-input"
      type="number"
      aria-label={label}
      value={value || ''}
      min={0}
      max={max}
      disabled={max === 0}
      onChange={(e) => onChange(Math.min(parseInt(e.target.value, 10) || 0, max))}
    />
  );
}

function SellRow({
  card,
  entry,
  setName,
  sellQty,
  foilSellQty,
  onSellChange,
  onFoilSellChange,
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
          value={sellQty}
          max={qty}
          onChange={onSellChange}
        />
      </td>
      <td className="qty-cell">{foil || ''}</td>
      <td className="qty-cell">
        <SellQtyInput
          label={`Foil sell ${card.name}`}
          value={foilSellQty}
          max={card.foil ? foil : 0}
          onChange={onFoilSellChange}
        />
      </td>
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
      {ckPrices && <td className="price-cell ck-cell">{formatCKPrice(ckEntry?.nonfoilBuy)}</td>}
      {ckPrices && <td className="price-cell ck-cell">{formatCKPrice(ckEntry?.foilBuy)}</td>}
    </tr>
  );
}

export default function SellModal({ onClose, openSets = [], ckPrices = null }) {
  const [allCards, setAllCards] = useState(null);
  const [collections, setCollections] = useState({});
  const [cardSetMap, setCardSetMap] = useState({});
  const [sellQtys, setSellQtys] = useState({});
  const [foilSellQtys, setFoilSellQtys] = useState({});

  useEffect(() => {
    (async () => {
      const storedKeys = await loadAllCollectionKeys();
      const openCodes = openSets.map((s) => s.code);
      const allCodes = [...new Set([...storedKeys, ...openCodes])];
      const cardAccum = [];
      const collectionAccum = {};
      const indexAccum = {};
      for (const code of allCodes) {
        const cards = (await loadCards(code)) ?? [];
        const coll = await loadCollection(code);
        collectionAccum[code] = coll;
        for (const card of cards) {
          if (!indexAccum[card.id]) {
            indexAccum[card.id] = code;
            cardAccum.push(card);
          }
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
    const closeOnEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const mergedCollection = useMemo(() => {
    const merged = {};
    for (const coll of Object.values(collections)) Object.assign(merged, coll);
    return merged;
  }, [collections]);

  const ownedCards = useMemo(() => {
    if (allCards === null) return null;
    return allCards.filter((card) => {
      const entry = mergedCollection[card.id];
      return (entry?.qty ?? 0) > 0 || (entry?.foil ?? 0) > 0;
    });
  }, [allCards, mergedCollection]);

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
                    <th className="qty-heading">Foil</th>
                    <th className="qty-heading">Foil Sell</th>
                    <th className="cost-cell">Set</th>
                    <th>Name</th>
                    <th>R</th>
                    <th className="cost-cell">Cost</th>
                    <th className="number-cell">#</th>
                    {ckPrices && <th className="price-cell ck-cell">CK</th>}
                    {ckPrices && <th className="price-cell ck-cell">CKF</th>}
                  </tr>
                </thead>
                <tbody>
                  {ownedCards.map((card) => (
                    <SellRow
                      key={card.id}
                      card={card}
                      entry={mergedCollection[card.id]}
                      setName={cardSetMap[card.id]}
                      sellQty={sellQtys[card.id] ?? 0}
                      foilSellQty={foilSellQtys[card.id] ?? 0}
                      onSellChange={(v) => setSellQtys((prev) => ({ ...prev, [card.id]: v }))}
                      onFoilSellChange={(v) =>
                        setFoilSellQtys((prev) => ({ ...prev, [card.id]: v }))
                      }
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
  );
}
