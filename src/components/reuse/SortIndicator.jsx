export default function SortIndicator({ active, direction }) {
  if (!active) return null;
  return (
    <span aria-hidden="true" className="sort-indicator">
      {' '}
      {direction === 1 ? '▲' : '▼'}
    </span>
  );
}
