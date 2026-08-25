# E-task brand specification

## Product principle

E-task helps the user commit to one concrete next step. The interface must reduce choice at the moment of focus, while keeping every secondary action easy to reach.

## Visual character

- Quiet, focused, precise, humane.
- One dominant focus object per viewport.
- Compact operational chrome around an airy focus zone.
- Flat fills and hairline separation instead of decorative gradients or stacked shadows.

## Core palette

- Canvas: `#F6F6F8`.
- Surface: `#FFFFFF`.
- Text: `#171821`.
- Muted text: `#686E80`.
- Primary action: `#5156E8` with white text.
- Accent: `#5B5FEF`, used sparingly.
- Border: `#DCDFEA`, decorative unless paired with a stronger state signal.

The verified legal pairings are recorded in `.tastemaker/style-lock.md`.

## Typography

- UI family: Geist Variable, bundled locally.
- Allowed weights: 400, 500, 600, 700.
- Base sizes: 12, 14, 16, 20, 24, 36, 60px.
- Timer values use tabular numerals.
- Headings are sentence case, balanced, and never italic.

## Shape and elevation

- 8px: small icon surfaces.
- 12px: inputs and buttons.
- 16px: dock groups and panels.
- 24px: dialogs and mobile sheets only.
- Fully circular geometry is reserved for the primary add button.
- Shadows are limited to controls, floating panels/dock, and modal elevation.

## Layout contracts

- Header: logo left; today, AI, and add actions right.
- Center: one selected task with an explicit timer action.
- Dock: always contains “Усі задачі” first on the left.
- Task queue: opens from the left.
- AI: opens from the right.
- Editing/settings: centered dialog on desktop, bottom sheet on mobile.

## Interaction contracts

- Selecting a task never starts its timer.
- Direct manipulation uses immediate pointer tracking and a smooth settle.
- Routine UI motion stays under 300ms and communicates state or origin.
- Touch targets are at least 44×44px on mobile.
- Every modal and panel supports Escape, visible focus, focus trapping, and focus return.
- Reduced-motion mode removes spatial motion but preserves state feedback.

## Icon and emoji policy

- Lucide is the only interface icon family.
- Native emoji are allowed only as user-selected task identity and inside the emoji catalog.
- Emoji never replace navigation, settings, close, delete, or other system icons.

## Avoid

- Gradients, gradient text, glass decoration, and ornamental blur.
- Nested cards, repeated pill labels, or a border around every content group.
- Metadata below 12px.
- Mixed icon families or arbitrary one-off SVGs.
- Motion that moves data during scanning.
- Secondary controls competing visually with the current task.
