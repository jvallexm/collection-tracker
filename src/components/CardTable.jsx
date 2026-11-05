const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'rarity', label: 'Rarity' },
  { key: 'cost', label: 'Cost' },
  { key: 'number', label: '#' },
];

// How far each navigation key moves between quantity boxes.
const FOCUS_STEP_BY_KEY = { w: -1, arrowup: -1, s: 1, arrowdown: 1, enter: 1 };

/**
 * Capitalizes the first letter of a word and leaves the rest unchanged.
 * @param {string} word - Word to capitalize.
 * @returns {string} Word with its first character uppercased.
 */
const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Keyboard handler attached to the table body that moves focus between quantity inputs.
 * W / Arrow Up moves to the previous row; S / Arrow Down / Enter moves to the next.
 * Does nothing for any other key so normal typing is unaffected.
 * @param {KeyboardEvent} event - The keydown event from the table body.
 */
function moveFocusBetweenInputs(event) {
  const step = FOCUS_STEP_BY_KEY[event.key.toLowerCase()];
  if (step === undefined) return;

  event.preventDefault();
  const inputs = Array.from(event.currentTarget.querySelectorAll('input'));
  const neighbor = inputs[inputs.indexOf(event.target) + step];
  if (neighbor) neighbor.focus();
}

/**
 * Focus handler that selects all text in a quantity box when the user clicks or tabs into it.
 * This way typing a new number immediately replaces the old one without needing to clear it first.
 * @param {FocusEvent} event - The focus event from a quantity input.
 */
function selectInputText(event) {
  event.target.select();
}

/**
 * Renders the scrollable card table with sortable column headers and editable quantity inputs.
 * @param {Object} props
 * @param {Object[]} props.cards - Sorted list of card objects to display.
 * @param {Object} props.collection - Collection map of cardId → quantity for showing current counts.
 * @param {function(string, string): void} props.onQuantityChange - Called with (cardId, typedText) when a quantity changes.
 * @param {function(string): void} props.onSort - Called with the column key when a header is clicked.
 */
export default function CardTable({ cards, collection, onQuantityChange, onSort }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="qty-heading">Have</th>
            {COLUMNS.map(({ key, label }) => (
              <th key={key} onClick={() => onSort(key)}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody onKeyDown={moveFocusBetweenInputs} onFocus={selectInputText}>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>
                <input
                  className="qty-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={`Copies of ${card.name}`}
                  value={collection[card.id] || ''}
                  onChange={(event) => onQuantityChange(card.id, event.target.value)}
                />
              </td>
              <td className="name-cell">{card.name}</td>
              <td>{capitalize(card.rarity)}</td>
              <td>{card.cost}</td>
              <td>{card.number}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
