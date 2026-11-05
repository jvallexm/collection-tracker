export default function QuantityCell({ col, label, value, onFocus, onChange }) {
  return (
    <td className="qty-cell">
      <input
        className="qty-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        data-col={col}
        aria-label={label}
        value={value}
        onFocus={onFocus}
        onChange={onChange}
      />
    </td>
  );
}
