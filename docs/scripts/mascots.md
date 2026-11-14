# Mascot art sources

The nine "Sect of Evolution" mascots in `docs/public/mascots/` are generated in Google Flow
(Nano Banana), in the maintainer's Flow project **"Nov 14 - 13:00"**. Every file has a 2D
version (`<id>.webp`) and a 3D figure version (`<id>-3d.webp`).

| id | Character | Flow tile title |
| --- | --- | --- |
| sect-master | Yue, Sect Master | Redraw character as chibi mascot |
| gatekeeper | Rin, Blade Gatekeeper | Blade Gatekeeper chibi redrawn |
| scroll-keeper | Mei, Scroll Keeper | Chibi Scroll Keeper explaining scrolls |
| twins | Hana & Sora, Branch Twins | Twin sisters standing back to back |
| disciple | Tao, New Disciple | Redrawing disciple as chibi character |
| weaver | Lan, Formation Weaver | Formation weaver casting rune circle |
| alchemist | Xia, Pill Alchemist | Alchemist holding pill furnace |
| messenger | Feng, Spirit Messenger | Spirit Messenger running happily |
| spirit-fox | Kitsu, Spirit Fox | Spirit fox sitting with question mark |

Each tile's version history holds: original chibi → vivid 2D → 3D figure.

## Prompts

Vivid 2D (with the previous chibi image as the reference):

> Redraw this exact same chibi character (same face, hair, outfit, props and pose) as a vivid,
> high-contrast version: bold clean dark outlines, crisp cel shading, strong saturated colors true to
> the character's own palette, punchy highlights and clear shadows. No pastel wash, no soft glow haze,
> no faded colors. Cute chibi game mascot style, full body, centered, plain pure white background, no text.

3D figure (edit of the vivid 2D version):

> Turn this exact chibi character into a 3D rendered chibi collectible figure: stylized 3D toon render
> (Blender / game character style), smooth sculpted forms, soft studio lighting with a crisp rim light,
> vivid saturated colors matching the original, same face, hair, outfit, props and pose. Full body,
> centered, plain pure white background, no base or stand, no text.

## Export

Download "1K original" from Flow, then remove the white background and export WebP (height 640):
flood-fill near-white pixels from the image border to transparent; for the 3D renders the grey floor
shadow (bottom 22% of the image, near-neutral and light) becomes a soft black shadow with alpha.
