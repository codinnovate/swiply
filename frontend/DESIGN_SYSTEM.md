# Swiply design system

Swiply uses a warm creator-studio visual language: editorial typography,
soft ivory surfaces, coral actions, violet structure, and mint success states.
The source of truth is `src/app/globals.css`; components consume semantic tokens
instead of hard-coded theme colors so light and dark modes stay consistent.

## Foundations

| Token | Use |
|---|---|
| `background` / `foreground` | Page canvas and primary text |
| `card` / `card-foreground` | Elevated working surfaces |
| `primary` | Main actions and selected states |
| `secondary` | Supporting actions and workspace identity |
| `accent` | Highlights and creator-focused moments |
| `muted` / `muted-foreground` | Secondary surfaces and explanatory text |
| `destructive` | Irreversible or dangerous actions |
| `border`, `input`, `ring` | Controls, dividers, and focus indication |

Spacing follows Tailwind's scale. Use rounded-xl controls and rounded-2xl cards.
Keep body copy compact and reserve the display face for page and card titles.

## Components

- `components/ui`: Button, Input, Textarea, Card, Badge, Dialog, and Skeleton.
- `components/forms/form-fields.tsx`: the required React Hook Form adapters for
  input, textarea, and select controls. Add new field types here so labels,
  descriptions, required marks, and errors remain consistent.
- `components/shared/states.tsx`: loading, empty, and recoverable error states.
- `components/app/page-header.tsx`: standard dashboard title and action layout.

Use Radix primitives for layered or stateful interfaces. Dialogs trap focus,
close with Escape, restore focus to their trigger, and label their content.
Icon-only controls need an accessible label. Every mutation must expose pending,
success, and failure feedback; every data view must include loading, empty, and
error states.

## Responsive behavior

The dashboard is mobile-first. The sidebar becomes an overlay below the large
breakpoint, page actions wrap, forms collapse to one column, and dense grids
reduce their column count. Do not add fixed widths that exceed a 320px viewport.

## Adding a component

1. Build the primitive in `components/ui` and use semantic CSS variables.
2. Forward native props and refs where the underlying primitive supports them.
3. Add focus-visible, disabled, dark-mode, and reduced-motion behavior.
4. Compose it in feature components; do not duplicate field or modal markup.
5. Run `npm run typecheck`, `npm run lint`, and `npm run build`.
