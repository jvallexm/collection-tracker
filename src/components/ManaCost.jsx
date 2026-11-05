function ManaSymbol({ symbol }) {
  if (symbol.includes('/')) {
    const [a, b] = symbol.split('/');
    return (
      <span className="mana-hybrid">
        <span className="mana-hybrid-letter">{a}</span>
        <span className="mana-hybrid-slash">/</span>
        <span className="mana-hybrid-letter">{b}</span>
      </span>
    );
  }
  return <span>{symbol}</span>;
}

export default function ManaCost({ cost }) {
  if (!cost) return null;
  const parts = cost.split(' // ');
  return (
    <span className="mana-cost">
      {parts.map((part, pi) => (
        <span key={pi} className="mana-cost-face">
          {pi > 0 && <span className="mana-sep"> // </span>}
          {[...part.matchAll(/\{([^}]+)\}/g)].map(([, sym], i) => (
            <ManaSymbol key={i} symbol={sym} />
          ))}
        </span>
      ))}
    </span>
  );
}
