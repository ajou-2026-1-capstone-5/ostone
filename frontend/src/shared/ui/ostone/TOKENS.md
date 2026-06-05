# Ostone Frontend Tokens

## Canonical Token Source

`frontend/src/shared/ui/ostone/tokens.css` is the source of truth for redesigned frontend UI tokens.

New frontend UI should prefer these token groups:

| Role | Tokens | Usage |
| --- | --- | --- |
| Surface | `--paper`, `--paper-2`, `--paper-3` | Page, panel, card, row, input backgrounds |
| Line | `--line`, `--line-2` | Borders, dividers, subtle separators |
| Text | `--ink`, `--ink-2`, `--ink-3`, `--ink-4` | Primary text through muted metadata |
| Signal | `--signal`, `--signal-ink`, `--signal-bg` | Positive or selected state accents |
| Status | `--warn`, `--warn-bg`, `--danger`, `--danger-bg`, `--info`, `--info-bg` | Warning, error, and informational states |
| Dark | `--dark-bg`, `--dark-bg-2`, `--dark-line`, `--dark-ink`, `--dark-ink-2`, `--dark-ink-3` | Dark shell and dark overlay surfaces |
| Radius | `--r-1`, `--r-2`, `--r-3`, `--r-pill`, `--radius-pill-row` | Small controls, menus, panels, cards, pills, rows |
| Spacing | `--s-1` through `--s-20` | 4px-based layout spacing |
| Type | `--sans`, `--mono`, `--serif` plus `.t-*` primitives | Shared typography primitives |

## Radius Baseline

| UI shape | Token |
| --- | --- |
| Small inline detail | `--r-1` |
| Menu, compact control, icon tile | `--r-2` |
| Card, panel, dialog, input, preview container | `--r-3` |
| Tab, CTA, badge, chip | `--r-pill` |
| Dense row item | `--radius-pill-row` |

Hardcoded `12px`, `16px`, or `999px` radius values should be replaced with one of these tokens when the component is already using the Ostone redesign surface tokens.

## Typography Baseline

Use `--sans` for product UI copy, form labels, panels, cards, and navigation. Use `--mono` for compact metadata, counters, technical labels, IDs, and uppercase eyebrows. `--serif` is currently an alias of `--sans`; do not introduce a new serif stack unless a separate design issue defines it.

Shared type primitives:

| Primitive | Usage |
| --- | --- |
| `.t-eyebrow` | Uppercase section labels and small technical signposts |
| `.t-num` | Numeric values that should align across rows or cards |
| `.t-title` | Compact card, panel, and section titles |
| `.t-display` | Large expressive headings inside redesigned Ostone surfaces |

## Legacy Alias Policy

`frontend/src/app/index.css` keeps legacy app-level variables such as `--bg-color`, `--text-primary`, `--radius-card`, and `--radius-xl` for older screens. Those aliases now point back to the Ostone redesign tokens where the role is equivalent.

Legacy aliases may remain when removing them would require broad screen rewrites. New components should not introduce additional uses of the legacy aliases unless they are maintaining an existing non-redesigned slice.

## Phased Audit Notes

This baseline intentionally does not rewrite every CSS module in one pass. Future cleanup should prioritize:

1. Shared components under `frontend/src/shared/ui/`.
2. Ostone shell components under `frontend/src/shared/ui/ostone/`.
3. Frequently reused page sections under `frontend/src/pages/`.
4. Feature-specific modules only when the feature is already being changed.

When replacing raw `rgba(...)`, first check whether the value is a semantic surface, line, text, focus, shadow, overlay, or status value. Shadows and product-content visuals may keep raw alpha values when no token role exists.
