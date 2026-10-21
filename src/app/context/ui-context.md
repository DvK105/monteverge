# UI Context

## Theme

Dark-only mode. The app uses the existing `src/app/index.css` token system without editing that file. The design direction is Apple-like: generous spacing, crisp Lexend typography, quiet dark surfaces, restrained violet accents, soft borders, and small purposeful transitions. `design-system.css` maps the existing tokens to the app's legacy semantic aliases and defines motion utilities.

## Colors

Define your color tokens as CSS custom properties. All components must use these tokens — no hardcoded hex values.

| Role | CSS Variable | Value |
| --- | --- | --- |
| Page background | `--bg-base` → `--background` | `oklch(0 0 0)` |
| Surface | `--bg-surface` → `--card` | `oklch(0.1591 0 0)` |
| Surface elevated | `--bg-elevated` → `--muted` | `oklch(0.2686 0 0)` |
| Primary text | `--text-primary` → `--foreground` | `oklch(1 0 0)` |
| Muted text | `--text-muted` → `--muted-foreground` | `oklch(0.7155 0 0)` |
| Primary accent | `--accent-primary` → `--primary` | `oklch(0.5676 0.2021 283.0838)` |
| Secondary accent | `--accent-secondary` → `--chart-2` | `oklch(0.5261 0.1705 314.6534)` |
| Border | `--border-default` → `--border` | `oklch(0.3012 0 0)` |
| Error | `--state-error` → `--destructive` | `oklch(0.6368 0.2078 25.3313)` |
| Success | `--state-success` → `--sidebar-accent` | `oklch(0.6746 0.1414 117.4260)` |

## Typography

| Role | Font | Variable |
| --- | --- | --- |
| UI text | Lexend | `--font-sans` |
| Editorial accent | Playfair Display | `--font-serif` |
| Code/mono | Source Code Pro | `--font-mono` |

## Border Radius

| Context | Class |
| --- | --- |
| Inline / small UI | `rounded-md` |
| Cards / panels | `rounded-xl` |
| Modals / overlays | `rounded-2xl` |

## Component Library

shadcn/ui built on top of Tailwind CSS v4. Components live in `components/ui/`. Use the CLI to add new components rather than writing from scratch.

## Layout Patterns

- **Terminal Workspace**: Full-viewport grid layout with a top status bar, left sidebar for stock universe & scenario controls, center canvas for real-time Monte Carlo fan charts and math formulas, and a right sidebar for metrics readouts and science fair defense Q&A.
- **Sidebars**: Fixed width with clean border separators (`border-r border-[var(--border-default)]`).
- **Modals**: Centered overlay with backdrop blur (`backdrop-blur-md bg-black/70`) for mathematical derivations and judge defense cards.
- **Navbar**: Top command bar with bottom border, live market clock, and execution latency indicator.

## Icons

Lucide React. Stroke-based icons only (`strokeWidth={1.5}` or `2`). Sizes: `h-4 w-4` for inline text, `h-5 w-5` for buttons and card headers.

## Responsive Behavior

- Keep the overview and simulation result routes inside the dynamic viewport with no document-level scrolling. Use compact, equal-height stock rows on narrow screens and let charts occupy the remaining flexible space; preserve all data through responsive panel toggles and the outcome/trace switch.
- Keep the overview fluid with a capped desktop width and small-screen gutters; avoid fixed viewport widths that cause horizontal scrolling.
- Keep interface text comfortably readable: use at least 11px for supporting labels, 14px for body copy, and larger sizes for primary figures. Increase padding and type at tablet and desktop widths without forcing small-screen overflow.
- Stack the equity grid and selected-stock detail panel through tablet widths. Use one stock column below 380px, two columns on phones and standard desktop layouts, and three columns only at wide desktop widths where cards retain room for prices and names.
- Let telemetry controls and numerical readouts stack on phones, then use two-column equation cards at wide tablet and desktop widths. Break long formulas across lines so they stay visible without adding horizontal page overflow.
- Keep dialogs within the dynamic viewport height and scroll their content internally so mobile browser chrome does not cover actions.

## Motion

- Use brief fade-and-rise entrances for page sections, stock cards, result panels, and modal content; stagger repeated items slightly.
- Animate only worker-computed path values as progress snapshots arrive; reveal percentile bands once the worker completes aggregation. Never animate predicted or fabricated market values.
- Honor `prefers-reduced-motion` globally. Keep hover and focus feedback subtle and preserve clear keyboard focus rings.
