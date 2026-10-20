# UI Context

## Theme

Dark-only mode. No light mode. The design language is a high-end Bloomberg/Hedge-Fund technical terminal — near-black layered backgrounds, glassmorphism card surfaces, and vivid electric cyan and signal green accent colors for interactive mathematical controls and quantitative indicators.

## Colors

Define your color tokens as CSS custom properties. All components must use these tokens — no hardcoded hex values.

| Role | CSS Variable | Value |
| --- | --- | --- |
| Page background | `--bg-base` | `#07090E` |
| Surface | `--bg-surface` | `#0D111A` |
| Surface elevated | `--bg-elevated` | `#131824` |
| Primary text | `--text-primary` | `#F1F5F9` |
| Muted text | `--text-muted` | `#94A3B8` |
| Primary accent | `--accent-primary` | `#00F0FF` |
| Secondary accent | `--accent-secondary` | `#7000FF` |
| Border | `--border-default` | `#1E293B` |
| Error | `--state-error` | `#FF1744` |
| Success | `--state-success` | `#00E676` |

## Typography

| Role | Font | Variable |
| --- | --- | --- |
| UI text | Geist Sans / Inter | `--font-sans` |
| Code/mono | Geist Mono / JetBrains Mono | `--font-mono` |

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