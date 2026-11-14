# Mascot and logo art sources

The logo character and the nine "Sect of Evolution" mascots are generated in Google Flow (Nano Banana),
in the maintainer's Flow project **"Nov 14 - 13:00"**. Every mascot has a 2D version
(`docs/public/mascots/<id>.webp`) and a 3D figure version (`<id>-3d.webp`). The logo lives in
`docs/public/brand/` and is built by `docs/scripts/brand.cjs`.

Style: extreme super-deformed (SD) chibi, about 1.5 heads tall. Each character is generated from a text
description, not from the older art: using the older images as a reference pulled the proportions back
to a long body.

| id | Character | Flow tile title (2D, then its 3D edit in the version history) |
| --- | --- | --- |
| logo | Blue-haired key holder in a shield | Boy holding golden key |
| sect-master | Yue, Sect Master | Woman holding jade seal stone |
| gatekeeper | Rin, Blade Gatekeeper | Swordswoman holding glowing cyan sword |
| scroll-keeper | Mei, Scroll Keeper | (Mei, hugging a scroll) |
| twins | Hana & Sora, Branch Twins | (twins with fans) |
| disciple | Tao, New Disciple | (Tao jumping with a talisman) |
| weaver | Lan, Formation Weaver | (Lan with a rune circle) |
| alchemist | Xia, Pill Alchemist | (Xia with a pill furnace) |
| messenger | Feng, Spirit Messenger | (Feng running with paper cranes) |
| spirit-fox | Kitsu, Spirit Fox | Spirit fox sitting down |

## Prompts

SD style block (prefix of every 2D prompt, followed by `CHARACTER: <description>`):

> Create ONE image, no reference image. STYLE IS THE MOST IMPORTANT PART: extreme super-deformed chibi like
> official anime SD merchandise art: the character is only about 1.5 heads tall, the HEAD IS TWO THIRDS OF
> THE TOTAL HEIGHT and the body is a tiny compact block under it; hands are simple round nubs with no
> fingers; feet are tiny nubs; a big voluminous hair mass; big anime eyes placed low on the face, NO nose,
> tiny mouth, small round pink blush ovals on the cheeks; thick black outline with varied line weight, NO
> white sticker border; flat colors with only one shadow tone and one small highlight on hair and eyes; very
> few details, clean simple silhouette. … Plain pure white background, no text.

Character descriptions used:

- **Yue**: long straight silver-white hair in a high bun with a jade hairpin and a small gold tassel, green eyes, black and white robe with gold trim and green cuffs, holding a glowing green jade seal stone.
- **Rin**: messy shoulder-length black hair with one teal streak, sharp teal eyes, dark green and teal guard robe with gold trim and a short cape, glowing cyan sword held diagonally.
- **Mei**: long wavy brown hair in a side braid with a jade ornament, round glasses, brown eyes, purple and cream scholar robe, hugging a glowing teal-and-gold scroll.
- **Hana & Sora**: back to back; Hana auburn high ponytail, red and gold robe, red fan with a flame; Sora navy braid, blue and silver robe, blue fan with a water splash; both winking.
- **Tao**: messy fluffy orange hair with a green ribbon, amber eyes, green and white trainee robe, wooden sword on the back, jumping with a fist raised, green check-mark talisman.
- **Lan**: long straight black hair in a high bun with a gold hairpin, teal eyes, dark teal robe, hands over a glowing jade rune circle.
- **Xia**: long bright green hair with two side buns, green alchemist robe with a pale green apron, bronze pill furnace with green smoke, floating pills.
- **Feng**: very long lavender hair with a blue feather, light blue and white robe, running and calling out, two blue paper cranes.
- **Kitsu**: small white nine-tailed fox sitting, teal and gold flame-tipped tails, violet eyes, green bead collar with a gold bell, question-mark bubble.
- **Logo**: original boy with bright electric blue spiky hair and round glasses, white and navy robe with a blue sash, golden key held like a sword, in front of a blue shield (#3B82F6, navy outline).

3D figure (edit of the 2D version):

> Turn this exact chibi character into a 3D rendered collectible vinyl figure with the SAME extreme
> super-deformed proportions (huge head, tiny body, nub hands and feet): stylized 3D toon render, smooth
> rounded sculpted forms, soft studio lighting with a crisp rim light, the same flat colors, same face, hair,
> outfit, props and pose. Full body, centered, plain pure white background, no base or stand, no text.

## Export

Download "1K original" from Flow. Flood-fill near-white pixels from the image border to transparent, trim,
and export WebP (height 640). For the 3D renders, the grey floor shadow under the feet becomes a soft alpha
shadow; Feng's 3D render also had a stray floor line cropped off below the feet.
