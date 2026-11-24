'use client';

const LAYOUTS = { '2-2': [2, 2], '2-1': [2, 1], '1-1': [1, 1] };

/** Denah kursi. Nomor kursi berurutan per baris; baris terakhir boleh tidak penuh. */
export default function SeatPicker({ capacity, layout = '2-2', taken = [], selected = [], onToggle, max = 6 }) {
  const [left, right] = LAYOUTS[layout] || LAYOUTS['2-2'];
  const perRow = left + right;
  const rows = Math.ceil(capacity / perRow);
  const takenSet = new Set(taken);
  const selectedSet = new Set(selected);

  function cell(n) {
    if (n > capacity) return <span key={n} className="seat-void" aria-hidden="true" />;
    const isTaken = takenSet.has(n);
    const isSel = selectedSet.has(n);
    const blocked = isTaken || (!isSel && selected.length >= max);
    return (
      <button
        key={n}
        type="button"
        className={`seat ${isSel ? 'selected' : ''} ${isTaken ? 'taken' : ''}`}
        disabled={blocked}
        aria-pressed={isSel}
        aria-label={`Kursi ${n}, ${isTaken ? 'sudah dipesan' : isSel ? 'dipilih' : 'kosong'}`}
        onClick={() => onToggle(n)}
      >
        {n}
      </button>
    );
  }

  const out = [];
  for (let r = 0; r < rows; r++) {
    const base = r * perRow;
    const cells = [];
    for (let i = 0; i < left; i++) cells.push(cell(base + i + 1));
    cells.push(<span key="gap" className="seat-gap" aria-hidden="true" />);
    for (let i = 0; i < right; i++) cells.push(cell(base + left + i + 1));
    out.push(
      <div className="seat-row" key={r}>
        {cells}
      </div>,
    );
  }

  return (
    <div>
      <div className="bus-shell">
        <div className="bus-front">
          <span>Depan</span>
          <span>Sopir</span>
        </div>
        {out}
      </div>
      <div className="legend">
        <span>
          <i />
          Kosong
        </span>
        <span>
          <i className="sel" />
          Dipilih
        </span>
        <span>
          <i className="tk" />
          Terisi
        </span>
      </div>
    </div>
  );
}
