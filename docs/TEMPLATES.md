# Catalogue look: garment templates

The *Catalogue look* turns a piece into a clean, evenly lit picture of that kind of garment in the person's own
colour and pattern. It works from **templates**: one photograph of each garment shape, taken in light cloth, kept as a
map of where the folds, seams and highlights are. The colour and the fabric (stripes, check, floral, 50+ of them) are
laid over that map in the browser, so the cloth still looks like cloth. There is no AI, no cost per picture and no
network call.

The pictures have to be real photographs that you have the right to use. The app ships with a first set made from
freely licensed photographs on Wikimedia Commons: a crew-neck tee, a button-up shirt, a pleated day dress, straight
chinos and trousers, a single-breasted blazer, a classic waistcoat, a
V-neck sweater vest and a quilted puffer vest (see `public/templates/CREDITS.md` for each source, author and licence). Until a garment type has a
template, the *Catalogue look* option does not appear for it (nothing is faked). Every template you add makes the option
appear for that type straight away.

## What makes a good template photo

* **Light cloth**: white, cream or light grey. Folds show best on light cloth. A dark garment has no information
  left in its shadows. (The tool warns when a photo is dark.)
* **Plain cloth**: no print, no logo, no text, no contrast stitching. Whatever is on it is carried into every colour.
* **Flat and square-on**: a flat lay shot from directly above, or a ghost mannequin / hanging shot from the front.
  Sleeves relaxed and slightly away from the body, collar and cuffs in a natural shape. Lightly steamed: real folds look
  good, deep creases do not.
* **Even light** from the front and a little above, soft shadows, plain backdrop. A white sheet or paper is perfect.
* **Big**: the garment at least 1000 pixels wide (1500 is better). The tool shrinks it to 1200.
* **Several cuts of the popular types**: a tee in crew and V-neck, jeans in straight and skinny, and so on.
  The person picks the closest one.

## Where the photographs can come from

1. **Your own**: lay clothes on a white sheet by a window and photograph them. Free, and fully yours.
2. **Stock photography** with a licence that allows editing and use inside an application (read the licence;
   "editorial use only" is not enough). Search for *"white t-shirt flat lay"*, *"ghost mannequin white shirt"*.
3. **Commissioned**: a photographer or a studio, for a day of garments. Ask for the rights to use and modify the
   pictures in the app and to keep the originals.
4. **Permissively licensed images** (public-domain or CC0 collections). Keep a note of where each came from.

Do **not** use pictures lifted from shops or other apps.

On Wikimedia Commons, museum collections photographed on a plain backdrop (the Met's CC0 images, DPLA partners) are a
good source of public-domain garments. A garment on a dress form brings the form's neck or stand into the cut-out, and
museum tags can hang below a hem; those have to be cleared from the template by hand. A photo on a backdrop of nearly
the same colour (khaki on a white sheet) may need cutting out yourself first; pass the transparent PNG to the tool.

## Adding one

```bash
npm run template:add -- ~/photos/white-shirt.jpg --type shirt --id classic-collar --label "Classic collar" --width 58 \
  --source "own photo" --author "Your name" --license "All rights reserved"
npm run template:check
npm run template:preview -- /tmp/templates.png      # every template in a few colours and fabrics, to judge by eye
```

* `--type` is one of the 59 garment types (below).
* `--id` is a short lowercase name, unique within the type.
* `--label` is what the person sees (it is not translated; keep it simple, or use a plain descriptive word).
* `--width` is how wide the garment really is in centimetres (chest, or the widest point). It sets the size of
  patterns, so a stripe is the same size on a tee and on a coat. A rough guess is fine.
* `--tags` is optional (`long-sleeve,button`).
* `--source`, `--author`, `--license` (and `--license-url`) record where the photo came from: the web page of the
  photo (or "own photo"), who made it and its licence. They are kept in `index.json` and `template:check` lists any
  template without them. Add a line to `public/templates/CREDITS.md` too. A photo under CC BY-SA makes a template that
  is shared under the same licence, with its credit.

The tool cuts the garment out, straightens and crops it, takes the colour out, and writes
`public/templates/<type>/<id>.png` plus the entry in `public/templates/index.json`. If it cannot find the garment on the
backdrop it says so; photograph it on a plainer surface, or cut it out yourself and pass a transparent PNG.

`npm run template:check` lists which garment types have a template and which do not, and checks the files (RGBA PNG,
sensible size, listed in the index). `npm run template:check -- --strict` also fails while any type is missing.

After adding templates, build and deploy as usual; the pictures are served as ordinary static files and cached by the
service worker.

## The shot list

One template per type gets the option switched on. Variants are extra choices worth shooting next.

| Type | Width (cm) | Shoot first | Then |
| --- | --- | --- | --- |
| tee | 52 | crew neck | V-neck, oversized/boxy |
| tank | 44 | classic tank | racerback |
| polo | 54 | short-sleeve polo | |
| longsleeve | 54 | crew neck, long sleeve | henley |
| shirt | 58 | long-sleeve button-up | short-sleeve, button-down collar |
| blouse | 54 | classic blouse | wrap, bow neck, sleeveless |
| sweater | 60 | crew neck | V-neck, turtleneck, chunky |
| cardigan | 58 | button front | open front |
| vest | 50 | sweater vest, V-neck | crew neck, cable knit |
| waistcoat | 50 | single-breasted, front | double-breasted |
| turtleneck | 54 | fine knit | chunky, mock neck |
| hoodie | 62 | pullover | zip-up |
| sportstop | 50 | short-sleeve | long-sleeve, sleeveless |
| jeans | 40 | straight | skinny, wide-leg |
| chinos | 40 | straight | slim |
| trousers | 42 | tailored, flat front | pleated, wide-leg |
| joggers | 42 | cuffed | |
| leggings | 34 | full length | cropped |
| shorts | 44 | chino shorts | athletic, denim |
| skirt | 48 | A-line | pencil, pleated midi, mini |
| cargo | 46 | cargo pants | |
| sundress | 52 | strappy | tiered |
| dress | 54 | shift / day dress | wrap, shirt dress |
| knitdress | 56 | long-sleeve | |
| eveningdress | 56 | full length | cocktail length |
| jumpsuit | 54 | wide-leg | |
| lightjacket | 60 | zip jacket | |
| denimjacket | 58 | classic trucker | oversized |
| bomber | 60 | ribbed hem | |
| blazer | 58 | single-breasted | double-breasted |
| raincoat | 60 | hooded | |
| trench | 62 | belted | |
| wool-coat | 64 | single-breasted | double-breasted, long |
| puffer | 64 | hip-length | long |
| parka | 66 | hooded | |
| overshirt | 60 | button front, chest pockets | |
| gilet | 60 | puffer vest, zipped | fleece vest |
| fleece | 60 | zip-up | |
| sneakers | 30 | side view, low top | high top |
| runners | 30 | side view | |
| loafers | 28 | side view | |
| dressshoes | 29 | oxford, side view | derby |
| boots | 28 | side view | ankle, tall |
| waterproofboots | 28 | side view | |
| chelsea | 27 | side view | |
| rainboots | 30 | side view | |
| sandals | 26 | flat | strappy |
| flats | 25 | ballet flat | |
| heels | 25 | pump | block heel, sandal |
| scarf | 60 | laid flat, rectangular | |
| beanie | 24 | cuffed | |
| gloves | 22 | pair, laid flat | |
| sunglasses | 14 | front view | |
| cap | 26 | side view | |
| sunhat | 40 | wide brim | |
| umbrella | 30 | closed | open |
| belt | 100 | coiled or straight | |
| bag | 34 | tote | crossbody, backpack |

Shoes and small accessories only offer the colours and fabrics that make sense on them (leather, canvas, suede and
a handful of prints); watches and sunglasses offer colour only. See `fabricsFor()` in `src/shared/fabrics.js`.

For shoes, photograph a single shoe from the side, toes pointing the same way every time (to the right), light-coloured
leather or canvas, sole included.

## How it works (for the curious)

`makeTemplate()` in `src/shared/catalogue.js` divides each pixel's brightness by the garment's typical brightness, so
the colour disappears and what is left is *shading*: 128 means neutral, more is lit, less is shadow. The template is
that shading in the red, green and blue channels and the garment's outline in the alpha channel.

`renderCatalogue()` lays the person's colour (and pattern) over it. The pattern is a small function from a point on the
cloth to "how much second colour is here" (`src/shared/fabrics.js`), so it never repeats visibly, never pixelates and is
the same real-world size on every garment. Pattern coordinates are bent along the folds so stripes and checks follow
the cloth instead of lying flat over it. Light is applied in linear light, and dark colours get a gentle highlight so
their folds do not vanish.
