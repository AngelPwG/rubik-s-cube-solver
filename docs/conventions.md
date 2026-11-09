# Shared cube conventions — complete before implementing moves

- State: six 3x3 matrices of colors.
- Matrix indexes: rows and columns numbered 0, 1, 2.
- Back view: transparent view from the front.
- TODO: Specify viewing orientation for up/down/left/right matrices as well.
- TODO: Assign the six colors to their solved faces.
- TODO: Define every move direction precisely. If using standard move notation,
  clockwise means looking directly at the turned face from outside, even when
  the stored matrix uses a transparent view.
- Cost proposal: one per quarter-turn, including inverses. Confirm as a team.
- TODO: Record exact sticker transfers and reversals for each move.
- TODO: Fix state-key face order and Wasm input/output format.
- TODO: Define expanded nodes and agree on comparison cases and limits.

The headings above are a checklist, not completed move definitions.
