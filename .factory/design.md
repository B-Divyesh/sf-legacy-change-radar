# Legacy Change Radar — visual thesis

## Direction: an annotated botanical field guide

Legacy code is a living system. A changed file is one specimen, while owners,
imports, migrations, and checks form the roots around it. The interface borrows
the care of a field botanist: warm paper, ink labels, ruled observations, and a
single pressed plant whose root system makes hidden connections visible. This is
not nostalgia for its own sake. The field-guide metaphor explains the product's
job: inspect a small visible change without losing its wider habitat.

The site is intentionally single-mode. Its parchment ground is part of the
artifact, not a theme preference. The CLI remains plain text and works in any
terminal theme.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#F2EAD5` | page ground |
| `--paper-deep` | `#E6D9B9` | inset surfaces and rules |
| `--ink` | `#17251D` | primary text |
| `--ink-muted` | `#4F5C51` | secondary text |
| `--fern` | `#245C43` | links, primary actions, positive state |
| `--fern-dark` | `#143D2C` | action hover and terminal shell |
| `--lichen` | `#B9C39A` | quiet highlights |
| `--ochre` | `#74400D` | warnings and annotation marks |
| `--rust` | `#8B3528` | errors and high-attention markers |
| `--white` | `#FFFDF5` | contrast text and lifted paper |

All text/action combinations target WCAG AA. Status labels always include words
or symbols; color never carries meaning alone.

## Type

- Display: Georgia, Cambria, `Times New Roman`, serif. Its humanist, printed
  forms carry the field-guide voice without a font download.
- Body and UI: ui-monospace, `SFMono-Regular`, Consolas, `Liberation Mono`,
  monospace. It connects annotations to diffs and terminals.
- The site uses system fonts only. No font request leaves the visitor's device.
- Scale: 14, 16, 20, 28, 44, and 64 px. Body text never drops below 16 px.

## Spacing and shape

An 8 px base rhythm controls layout. Section space is 64–112 px; component
space is 8–32 px. Content measures at most 70 characters. Paper sheets use
2 px ink rules, clipped corners, and small specimen labels. Buttons are solid
rectangles with a subtle bottom edge, never pills. The terminal uses a deep
green shell and paper-colored text.

On a 390 px screen, the specimen art follows the call to action and the terminal
becomes a horizontally scrollable observation window. Non-essential marginalia
is hidden. Nothing becomes smaller than a 44 px target.

## Interaction grammar

- Links are underlined like cross-references in a printed guide.
- Primary buttons resemble stamped catalog labels and depress by 2 px.
- A route change focuses the new heading and announces its title.
- Risk observations use a left margin mark, a short label, evidence, and a
  reason. The same hierarchy appears in generated Markdown.
- Demo playback reveals terminal lines in order. Reset returns to a blank prompt;
  play starts the same recorded command again.

## Motion policy

The signature motion is a one-time “specimen unfurl”: root paths draw once as
the hero enters, followed by the terminal lines at 90 ms intervals. UI feedback
uses 160–220 ms transform or opacity changes. Nothing loops. With
`prefers-reduced-motion: reduce`, the full plant and all terminal lines appear
immediately; smooth scrolling and transforms are removed.

## Asset plan and provenance

- Hero: original raster illustration generated for this product with
  `/opt/fleet/lib/gen-image.sh` using the factory image deployment. Prompt:
  “Editorial botanical field-guide plate of one pressed fern specimen whose
  fine roots transform into a precise software dependency graph, archival
  parchment, deep forest-green ink, small ochre observation ticks, spacious
  asymmetrical composition, scientific engraving with light risograph texture,
  no words, no letters, no logos, no watermark.” The selected source is stored
  under `.factory/provenance/`; the WebP derivative is capped at 300 KB.
  Generated 2026-08-28 with deployment `factory-image`, high quality,
  1536×1024. The exact prompt and settings are stored beside the source.
- Open Graph image: composed locally from the same original art with HTML/CSS,
  then captured at 1200×630. It adds live text outside the raster image.
- Favicon and wordmark: hand-made SVG using a simple leaf/root silhouette. They
  are project-native vector marks, not generated or copied assets.
- Terminal recording: produced from the real bundled CLI demo. It contains no
  synthetic output and uses no external player or CDN.

No stock material or third-party visual asset is used.
