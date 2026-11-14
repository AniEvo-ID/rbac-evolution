# Mascot and logo art sources

The logo character and the nine "Sect of Evolution" mascots are generated in Google Flow (Nano Banana),
in the maintainer's Flow project **"Nov 14 - 13:00"**. Every mascot has a 2D still
(`docs/public/mascots/<id>.webp`); animated guardians also have a chibi clip (`<id>-chibi.*`) and a full-size
anime clip (`<id>-anime.*`), each as `.webm` (VP9 + alpha), `.mov` (HEVC + alpha, Safari) and a `.webp` poster. The logo lives in
`docs/public/brand/` and is built by `docs/scripts/brand.cjs`.

Style: extreme super-deformed (SD) chibi, about 1.5 heads tall. Each character is generated from a text
description, not from the older art: using the older images as a reference pulled the proportions back
to a long body.

| id | Character | Flow tile title |
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

## Animated clips

Every guardian has a chibi clip and an anime clip, made in the same Flow project with the agent (image 16:9 x1,
Nano Banana 2.1; video 16:9 x1, Veo 3.1 Quality, 6 seconds). Start a new agent chat when it begins answering
the previous message instead of the latest one.

1. Chibi: attach the 2D still and ask for the same character redrawn on a flat chroma-key screen, filling about
   55% of the height. Anime: no reference; describe the character with normal proportions, whole body visible,
   about 70% of the height, on the same screen.
2. Attach that image and ask Veo for a 6-second 16:9 video: flat 2D cel animation (not 3D), static camera, the
   screen color throughout, the image as first and last frame, the action in between, everything inside the frame.
3. Download the 720p MP4 and run `docs/scripts/key-video.sh` with `CROP` set to the area the action uses
   (every frame keyed, union of the visible pixels, plus 3% of the height), `HEIGHT=580` for chibi and
   `HEIGHT=640` for anime (the largest the page shows them; wide clips are also capped at 960 px). WebM and
   MOV are capped at 1.5 Mbit/s, about 1-2 MB per clip. `KEY` defaults to the color in the top-left corner,
   since Veo's green drifts.

Screens and key settings that differ from the defaults (`SIM=0.38`, green screen):

| Clip | Why |
| --- | --- |
| alchemist-*, spirit-fox-* | Magenta screen (`#FF00FF`): Xia's hair and Kitsu's tail tips are green. |
| weaver-anime `SIM=0.20`, weaver-chibi `SIM=0.28` | Lan's dark jade robe is close to the screen color. |
| disciple-anime `SIM=0.16` | Tao's trousers are green. |
| gatekeeper-anime `CROP=1554:1068:146:6`, gatekeeper-chibi `CROP=822:666:194:10` | Rin was made at 1080p (anime). |

Actions: Yue raises her jade seal and a sigil spins; Rin swings her sword; Mei opens her scroll and glyphs
orbit; Hana and Sora swirl fire and water; Tao kicks and flashes a talisman; Lan casts a jade rune circle;
Xia's furnace puffs smoke and she catches a pill; Feng calls out while paper cranes flap; Kitsu tilts its head,
swishes its tails and lights foxfire.

## Export

Download "1K original" from Flow. Flood-fill near-white pixels from the image border to transparent, trim,
and export WebP (height 640).
