export default function TitlebarButton({ label, iconClass, onClick }) {
  return (
    <button className="titlebar-btn" aria-label={label} onClick={onClick}>
      <span className={iconClass} />
    </button>
  );
}
