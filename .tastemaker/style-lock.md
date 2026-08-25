# Style lock — E-task

Established: 2026-08-25. Source: user-approved Focus Dock reference plus approved Design Read.

## Palette
- Background: #F6F6F8 — quiet application canvas.
- Surface: #FFFFFF — dock, panels, dialogs, and inputs.
- Primary: #5156E8 — primary actions and selected states.
- Accent: #5B5FEF — icons and concise emphasis only.
- Text primary: #171821 — contrast vs Background 16.36:1; WCAG AA pass.
- Text muted: #686E80 — contrast vs Background 4.71:1 and Surface 5.08:1; WCAG AA pass.
- Border: #DCDFEA — decorative separation only unless paired with a stronger focus outline.
- Button label: #FFFFFF — contrast vs Primary 5.46:1; WCAG AA pass.
- Dark mode: not needed for this project; single light mode.

## Color contract
- Text-safe: text/surface, text/background, text/border, surface/primary, primary/on-primary, background/primary, surface/accent, accent/on-primary, muted/background, muted/surface.
- UI-safe: background/accent, primary/border, accent/border, text/accent, text/primary.
- Decorative only: surface/border, background/border, primary/accent, background/surface.
- Decorative borders never convey focus, selection, or validation without a stronger color or icon/text state.

## Typography
- Family: Geist with Segoe UI and system sans-serif fallbacks.
- Scale: 12, 14, 16, 20, 24, 36, 60px.
- Weights: 400, 500, 600, 700 only.
- Timer and durations use tabular numerals.

## Shape language
- Radius 8px: icon tiles and compact controls.
- Radius 12px: inputs and buttons.
- Radius 16px: dock items and grouped surfaces.
- Radius 24px: dialogs and floating panels only.
- 999px is reserved for status chips and circular controls.
- Hairlines separate content; shadows are limited to control, floating dock/panel, and modal levels.

## Density & spacing
- Base unit: 4px.
- Tokens in use: 4, 8, 12, 16, 24, 32, 48, 64px.
- Compact list/dock padding: 12–16px.
- Primary focus area spacing: 24–32px.
- Overall density: compact operational UI with one airy focus zone.
- Separation: whitespace and hairlines, not nested cards.

## Reference intelligence
- Reference board: `.tastemaker/reference-board.md` — local approved reference viewed; external references inferred, not viewed.
- Design read: focus-first task manager for individual desktop and mobile users, mode Operate, quiet editorial utility lane.
- Dials: variance 4, motion 3, density 5, art direction 6.
- Foundation: existing React/CSS stack; no registry or new component framework added.
- Quality bar: approved Focus Dock composition, iOS-like direct manipulation, calm productivity-tool hierarchy.
- Direction contract: Thesis — one task deserves attention at a time; First viewport — current task and explicit start action; System — flat surfaces, restrained accent, compact dock, progressive disclosure; Risk — cardification and oversized decorative controls.
- Anti-references: generic SaaS gradients, repeated pill labels, nested cards, tiny metadata, mixed icon families, decorative motion.

## Taste memory
- Profile priors used: none.
- Decision log: `.tastemaker/decisions.log`.
- Last resolved decisions: preserve approved Focus Dock; simplify visual density; use Lucide icons; keep emoji as user-selected task content.
- Pending review: first implemented redesign pass.
- Profile promotion: none; these choices remain project-specific.

## Navigation chrome
- Header and lower dock are the persistent shell; no sidebar is introduced.
- “Усі задачі” is always the first sticky dock item on the left.
- Task queue opens from the left; AI opens from the right.
- Content canvas remains the quietest surface.

## Mood descriptors
Quiet, focused, precise, humane.

## Assets
- Anchor asset: `docs/design-explorations/focus-dock-refined.html`.
- Asset style: Lucide outline icons with consistent stroke; native emoji only as explicit task identity.
- Logo: existing E-task logo and favicon preserved unchanged.

## Motion
- Feel: crisp and operational with iOS-like settle for direct manipulation.
- Curves: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`.
- Durations: press 120ms, popover 180ms, panel 240ms.
- Screen track: app-shell state, panel, and list motion only; no scroll storytelling.
- Frequency: timer updates and routine scanning do not animate; drag tracks the pointer directly.
- Reduced motion: no spatial entrance or inertia; state feedback remains through opacity/color.

## Do not
- No gradients.
- No decorative emoji-as-icon substitution; emoji remains user-selected task content.
- No new icon family beyond Lucide.
- No automatic timer start when selecting a task.
- No excessive pills, shadows, nested cards, or text below 12px.
