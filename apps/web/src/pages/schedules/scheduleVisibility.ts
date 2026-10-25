/** Prawa krawędź sticky kolumny pracownika w siatce. */
export function scheduleStickyNameRight(from: Element): number {
  const sticky = from
    .closest(".schedule-matrix")
    ?.querySelector(".schedule-name-col:not(.schedule-name-head)");
  return sticky instanceof HTMLElement
    ? sticky.getBoundingClientRect().right
    : 0;
}

/** Komórka dnia w całości na prawo od sticky kolumny (nie zasłonięta). */
export function isScheduleCellFullyVisible(cell: HTMLElement): boolean {
  const rect = cell.getBoundingClientRect();
  return rect.left >= scheduleStickyNameRight(cell) - 1;
}
