export default function Titlebar({ children, onMouseDown, cursor }) {
  return (
    <div
      className="titlebar"
      style={cursor ? { cursor } : undefined}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  );
}
