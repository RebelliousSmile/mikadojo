# DESIGN.md

## Design Implementation
- **Design System Approach**: CSS custom properties defined in `:root`
- **Styling Method**: Single `styles.css` file, no framework or preprocessor

## Design System Files
- **Theme Config**: `styles.css` (`:root` variables for colors, shadow)

## Color Palette
- `--bg-1: #f5efe6` - warm beige page background
- `--bg-2: #f0d6b9` - darker beige gradient endpoint
- `--ink-1: #1f1d1a` - primary dark text
- `--ink-2: #5a554e` - secondary muted text
- `--accent-1: #e05c2b` - orange (blocked state, root markers)
- `--accent-2: #1f7a7a` - teal (done state, active tabs, tags)
- `--accent-3: #f0b429` - gold (in-progress state)
- `--card: #fffdf8` - warm white card surface
- `--stroke: rgba(31, 29, 26, 0.08)` - subtle border
- `--shadow: 0 14px 40px rgba(31, 29, 26, 0.15)` - elevated shadow
- `#2aa39a` - lighter teal used in active tab/button gradients
- `#b8860b` - dark gold for in-progress status text

## Typography
- Font stack: "Space Grotesk", "Segoe UI", Tahoma, sans-serif
- Brand title: 1.4rem, weight 700
- Card title: 0.95rem, weight 700
- Card description: 0.9rem, muted color
- Labels/meta: 0.75rem uppercase with letter-spacing 0.08em
- Tags: 0.75rem with pill shape
- Status badges: 0.7rem, weight 600

## Component Standards
- **Cards**: Warm white (`--card`), 14px border-radius, subtle border + soft shadow, entrance animation (fade-up via `rise` keyframe), 12px bottom margin
- **Summary Cards**: 16px border-radius, same card surface, grid-based auto-fit layout (min 200px)
- **Status Buttons**: Pill-shaped (999px radius), 0.7rem, lift on hover (-1px translateY), active state fills teal
- **Tags**: Pill-shaped, teal tinted background; `.blocked` variant uses orange tint
- **Tabs**: Pill-shaped, semi-transparent white background, active state uses teal gradient (140deg)
- **Graph Nodes**: 14px border-radius, 2px colored border per status, min 180px / max 240px, centered text
- **Action Items**: 8px border-radius, tinted background per state (done=teal, failed=orange, running=gold)
- **Buttons**: Primary (`file-button`) is orange with white text; secondary (`ghost-button`) is card-colored with border

## Layout System
- Body: radial + linear gradient background, full viewport height
- Page header: flexbox, wraps, 28px top / 40px sides padding
- Main content: 40px horizontal padding, 60px bottom
- Board view: CSS grid, `repeat(auto-fit, minmax(260px, 1fr))`, 18px gap
- Columns: Semi-transparent white (0.6 opacity), 18px border-radius, backdrop-filter blur
- Graph view: SVG-based (D3), layered vertical layout with 60px gap between layers
- View toggle: pill-shaped button group in a rounded container
- Responsive: at 720px breakpoint, padding reduces to 20px
- Brand mark: 52px square, 16px border-radius, orange-to-gold gradient

## Accessibility
- No ARIA roles or labels
- No visible focus indicators
- No skip-to-content link
- No reduced-motion media query for the `rise` animation
- Color contrast likely sufficient (dark ink on light backgrounds)
