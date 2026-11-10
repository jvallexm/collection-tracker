import { useEffect, useState } from 'react';
import Titlebar from './Titlebar.jsx';
import TitlebarButton from './TitlebarButton.jsx';

const DEFAULT_POS = { x: 300, y: 100 };

export default function DraggableWindow({
  title,
  children,
  controls,
  onClose,
  initialPos = DEFAULT_POS,
  onSavePos,
  width,
  className,
}) {
  const [pos, setPos] = useState(initialPos);
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    if (!drag) return;
    function onMove(e) {
      setPos({ x: e.clientX - drag.startX, y: e.clientY - drag.startY });
    }
    function onUp() { setDrag(null); }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [drag]);

  function handleTitlebarMouseDown(e) {
    setDrag({ startX: e.clientX - pos.x, startY: e.clientY - pos.y });
  }

  const cls = ['window', 'draggable-window', className].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 200, userSelect: drag ? 'none' : undefined, width }}
    >
      <Titlebar onMouseDown={handleTitlebarMouseDown} cursor={drag ? 'grabbing' : 'move'}>
        <span>{title}</span>
        <div className="titlebar-buttons">
          <TitlebarButton label="Close" iconClass="close-icon" onClick={onClose} />
        </div>
      </Titlebar>
      {children}
      <div className="draggable-window-footer">
        {controls}
        <div className="draggable-window-pos-btns">
          <button
            className="draggable-window-reset-btn"
            onClick={() => setPos(initialPos)}
          >
            Reset
          </button>
          <button
            className="draggable-window-move-btn"
            disabled={pos.x < 0 || pos.y < 0}
            onClick={() => { onSavePos?.(pos); onClose?.(); }}
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}
