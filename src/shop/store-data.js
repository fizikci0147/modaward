/**
 * The built-in store database, one store per line:
 *
 *   id | Name | domain | tier | department | style | carries | regions | default in | search
 *
 * tier        v value · m mid · p premium
 * department  mw men and women · w women · m men
 * style       a preset in STYLES below (how the store's character fits each style archetype)
 * carries     a preset in CARRIES below (which garment categories it sells)
 * regions     where it ships, as region codes (see regions.js), or * for everywhere
 * default in  regions where it is part of the starter set used when the person has picked no stores, or -
 * search      the store's own search URL with {q}, only where we are certain of it; blank means a
 *             Google site: search of the domain, which is always a valid link
 *
 * Domains are the stores' main public sites. `npm run stores:check` visits every one and reports any that no longer
 * answer, so a wrong or retired address is a one-line fix here.
 */

export const STYLES = {
  basics: { minimal: 0.9, casual: 0.85, classic: 0.6, polished: 0.4 },
  fast: { casual: 0.8, street: 0.7, minimal: 0.6, boho: 0.5, polished: 0.4, sporty: 0.35 },
  trend: { street: 0.9, casual: 0.7, boho: 0.6, minimal: 0.55, polished: 0.5, sporty: 0.5 },
  classic: { classic: 0.95, polished: 0.8, minimal: 0.65, casual: 0.5 },
  polished: { polished: 0.9, minimal: 0.8, classic: 0.65, boho: 0.4, casual: 0.35 },
  sport: { sporty: 1, street: 0.75, casual: 0.55 },
  outdoor: { sporty: 0.7, casual: 0.85, classic: 0.5, minimal: 0.4 },
  casual: { casual: 0.95, street: 0.5, classic: 0.45, sporty: 0.4 },
  boho: { boho: 0.95, casual: 0.7, minimal: 0.5, polished: 0.4 },
  luxury: { polished: 0.9, minimal: 0.8, classic: 0.7, street: 0.5, boho: 0.4 },
  street: { street: 0.95, sporty: 0.6, casual: 0.7, minimal: 0.4 },
  dept: { classic: 0.75, polished: 0.75, minimal: 0.65, casual: 0.6, street: 0.45, boho: 0.45, sporty: 0.45 },
  market: { casual: 0.6, street: 0.6, boho: 0.6, minimal: 0.5, classic: 0.5, polished: 0.5, sporty: 0.5 },
  minimal: { minimal: 0.95, polished: 0.7, classic: 0.5, casual: 0.5 },
  prep: { classic: 0.95, casual: 0.7, polished: 0.6, minimal: 0.45 }
};

export const CARRIES = {
  all: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'],
  clothes: ['top', 'bottom', 'dress', 'outerwear', 'accessory'],
  menswear: ['top', 'bottom', 'outerwear', 'accessory'],
  menall: ['top', 'bottom', 'outerwear', 'shoes', 'accessory'],
  sport: ['top', 'bottom', 'outerwear', 'shoes', 'accessory'],
  shoes: ['shoes', 'accessory'],
  bags: ['accessory']
};

const ROWS = `
# ── Everywhere ──
yoox|YOOX|yoox.com|m|mw|luxury|all|*|-
asos|ASOS|asos.com|v|mw|trend|all|*|-
shein|SHEIN|shein.com|v|mw|fast|all|*|-
farfetch|Farfetch|farfetch.com|p|mw|luxury|all|*|-
ssense|SSENSE|ssense.com|p|mw|luxury|all|*|-
mrporter|Mr Porter|mrporter.com|p|m|luxury|menall|*|-
netaporter|Net-a-Porter|net-a-porter.com|p|w|luxury|all|*|-
cos|COS|cos.com|m|mw|polished|all|*|-
arket|Arket|arket.com|m|mw|basics|all|*|-
weekday|Weekday|weekday.com|v|mw|street|all|*|-
monki|Monki|monki.com|v|w|trend|clothes|*|-
stories|& Other Stories|stories.com|m|w|polished|all|*|-
bershka|Bershka|bershka.com|v|mw|trend|all|*|-
pullbear|Pull&Bear|pullandbear.com|v|mw|street|all|*|-
stradivarius|Stradivarius|stradivarius.com|v|w|trend|all|*|-
massimodutti|Massimo Dutti|massimodutti.com|m|mw|classic|all|*|-
oysho|Oysho|oysho.com|m|w|sport|clothes|*|-
adidas|adidas|adidas.com|m|mw|sport|sport|*|-
puma|PUMA|puma.com|m|mw|sport|sport|*|-
newbalance|New Balance|newbalance.com|m|mw|sport|sport|*|-
underarmour|Under Armour|underarmour.com|m|mw|sport|sport|*|-
reebok|Reebok|reebok.com|m|mw|sport|sport|*|-
asics|ASICS|asics.com|m|mw|sport|sport|*|-
hoka|HOKA|hoka.com|m|mw|sport|shoes|*|-
onrunning|On|on.com|p|mw|sport|sport|*|-
converse|Converse|converse.com|v|mw|street|shoes|*|-
vans|Vans|vans.com|v|mw|street|sport|*|-
fila|FILA|fila.com|v|mw|sport|sport|*|-
champion|Champion|champion.com|v|mw|casual|sport|*|-
levis|Levi's|levi.com|m|mw|casual|clothes|*|-
wrangler|Wrangler|wrangler.com|v|mw|casual|clothes|*|-
lee|Lee|lee.com|v|mw|casual|clothes|*|-
diesel|Diesel|diesel.com|p|mw|street|all|*|-
gstar|G-Star RAW|g-star.com|m|mw|street|clothes|*|-
pepejeans|Pepe Jeans|pepejeans.com|m|mw|casual|clothes|*|-
calvinklein|Calvin Klein|calvinklein.com|m|mw|basics|all|*|-
tommy|Tommy Hilfiger|tommy.com|m|mw|prep|all|*|-
lacoste|Lacoste|lacoste.com|p|mw|prep|all|*|-
ralphlauren|Ralph Lauren|ralphlauren.com|p|mw|prep|all|*|-
hugoboss|HUGO BOSS|hugoboss.com|p|mw|classic|all|*|-
armaniexchange|Armani Exchange|armaniexchange.com|m|mw|street|all|*|-
guess|GUESS|guess.com|m|mw|trend|all|*|-
michaelkors|Michael Kors|michaelkors.com|p|mw|polished|all|*|-
coach|Coach|coach.com|p|mw|polished|all|*|-
katespade|kate spade new york|katespade.com|p|w|polished|all|*|-
toryburch|Tory Burch|toryburch.com|p|w|polished|all|*|-
gucci|Gucci|gucci.com|p|mw|luxury|all|*|-
prada|Prada|prada.com|p|mw|luxury|all|*|-
burberry|Burberry|burberry.com|p|mw|luxury|all|*|-
dior|Dior|dior.com|p|mw|luxury|all|*|-
saintlaurent|Saint Laurent|ysl.com|p|mw|luxury|all|*|-
balenciaga|Balenciaga|balenciaga.com|p|mw|luxury|all|*|-
versace|Versace|versace.com|p|mw|luxury|all|*|-
valentino|Valentino|valentino.com|p|mw|luxury|all|*|-
fendi|Fendi|fendi.com|p|mw|luxury|all|*|-
armani|Giorgio Armani|armani.com|p|mw|luxury|all|*|-
maxmara|Max Mara|maxmara.com|p|w|luxury|clothes|*|-
moncler|Moncler|moncler.com|p|mw|luxury|all|*|-
stoneisland|Stone Island|stoneisland.com|p|m|street|menall|*|-
goldengoose|Golden Goose|goldengoose.com|p|mw|street|all|*|-
acnestudios|Acne Studios|acnestudios.com|p|mw|luxury|all|*|-
isabelmarant|Isabel Marant|isabelmarant.com|p|w|boho|all|*|-
jacquemus|Jacquemus|jacquemus.com|p|w|luxury|all|*|-
apc|A.P.C.|apc.fr|p|mw|minimal|clothes|*|-
sandro|Sandro|sandro-paris.com|p|mw|polished|clothes|*|-
maje|Maje|maje.com|p|w|polished|clothes|*|-
zadigvoltaire|Zadig&Voltaire|zadig-et-voltaire.com|p|mw|street|clothes|*|-
sezane|Sézane|sezane.com|m|w|polished|clothes|*|-
reformation|Reformation|thereformation.com|p|w|boho|clothes|*|-
vestiaire|Vestiaire Collective|vestiairecollective.com|p|mw|market|all|*|-
vinted|Vinted|vinted.com|v|mw|market|all|*|-|https://www.vinted.com/catalog?search_text={q}
depop|Depop|depop.com|v|mw|market|all|*|-|https://www.depop.com/search/?q={q}
etsy|Etsy|etsy.com|m|mw|market|all|*|-|https://www.etsy.com/search?q={q}
ebay|eBay|ebay.com|v|mw|market|all|*|-|https://www.ebay.com/sch/i.html?_nkw={q}
patagonia|Patagonia|patagonia.com|p|mw|outdoor|sport|*|-
thenorthface|The North Face|thenorthface.com|p|mw|outdoor|sport|*|-
columbia|Columbia|columbiasportswear.com|m|mw|outdoor|sport|*|-
arcteryx|Arc'teryx|arcteryx.com|p|mw|outdoor|sport|*|-
carhartt|Carhartt|carhartt.com|m|mw|street|menall|*|-
carharttwip|Carhartt WIP|carhartt-wip.com|m|mw|street|all|*|-
drmartens|Dr. Martens|drmartens.com|m|mw|street|shoes|*|-
timberland|Timberland|timberland.com|m|mw|outdoor|menall|*|-
birkenstock|Birkenstock|birkenstock.com|m|mw|casual|shoes|*|-
crocs|Crocs|crocs.com|v|mw|casual|shoes|*|-
skechers|Skechers|skechers.com|v|mw|casual|shoes|*|-
clarks|Clarks|clarks.com|m|mw|classic|shoes|*|-
ecco|ECCO|ecco.com|m|mw|classic|shoes|*|-
ugg|UGG|ugg.com|m|mw|casual|shoes|*|-
stevemadden|Steve Madden|stevemadden.com|m|mw|trend|shoes|*|-
aldo|ALDO|aldoshoes.com|m|mw|trend|shoes|*|-
allbirds|Allbirds|allbirds.com|m|mw|basics|shoes|*|-
veja|VEJA|veja-store.com|m|mw|minimal|shoes|*|-
camper|Camper|camper.com|m|mw|minimal|shoes|*|-
geox|Geox|geox.com|m|mw|classic|shoes|*|-
lululemon|lululemon|lululemon.com|p|mw|sport|sport|*|-
gymshark|Gymshark|gymshark.com|m|mw|sport|sport|*|-
vuori|Vuori|vuoriclothing.com|p|mw|sport|sport|*|-
aloyoga|Alo Yoga|aloyoga.com|p|mw|sport|sport|*|-
fabletics|Fabletics|fabletics.com|m|mw|sport|sport|*|-
desigual|Desigual|desigual.com|m|mw|boho|all|*|-
benetton|United Colors of Benetton|benetton.com|m|mw|casual|clothes|*|-
sisley|Sisley|sisley.com|m|mw|classic|clothes|*|-
esprit|Esprit|esprit.com|m|mw|basics|clothes|*|-
marcopolo|Marc O'Polo|marc-o-polo.com|m|mw|polished|clothes|*|-
scotchsoda|Scotch & Soda|scotch-soda.com|m|mw|street|clothes|*|-
suitsupply|Suitsupply|suitsupply.com|p|mw|classic|clothes|*|-
veromoda|Vero Moda|veromoda.com|v|w|fast|clothes|*|-
jackjones|Jack & Jones|jackjones.com|v|m|fast|menswear|*|-
only|ONLY|only.com|v|w|fast|clothes|*|-
selected|SELECTED|selected.com|m|mw|polished|clothes|*|-
decathlon|Decathlon|decathlon.com|v|mw|sport|sport|*|-
eileenfisher|Eileen Fisher|eileenfisher.com|p|w|minimal|clothes|*|-
quince|Quince|onequince.com|m|mw|basics|all|US,CA|-
kotn|Kotn|kotn.com|m|mw|basics|clothes|*|-
pact|Pact|wearpact.com|m|mw|basics|clothes|US|-

# ── United States ──
uniqlo|Uniqlo|uniqlo.com|v|mw|basics|clothes|*|US,CA,GB,AU,DE,FR,ES,IT,NL
hm|H&M|hm.com|v|mw|fast|all|*|US,CA,GB,AU,DE,FR,ES,IT,PT,NL,TR,BR,MX
zara|Zara|zara.com|m|mw|polished|all|*|CA,GB,AU,DE,FR,ES,IT,PT,NL,TR,BR,MX
mango|Mango|mango.com|m|mw|polished|all|*|CA,GB,AU,DE,FR,ES,IT,PT,NL,TR,BR,MX
nike|Nike|nike.com|m|mw|sport|sport|*|CA,GB,AU,DE,FR,ES,IT,PT,NL,TR,BR,MX
gap|Gap|gap.com|v|mw|casual|clothes|US|-
macys|Macy's|macys.com|m|mw|dept|all|US|-
kohls|Kohl's|kohls.com|v|mw|casual|all|US|-
jcpenney|JCPenney|jcpenney.com|v|mw|casual|all|US|-
bloomingdales|Bloomingdale's|bloomingdales.com|p|mw|dept|all|US|-
saks|Saks Fifth Avenue|saksfifthavenue.com|p|mw|luxury|all|US|-
neimanmarcus|Neiman Marcus|neimanmarcus.com|p|mw|luxury|all|US|-
dillards|Dillard's|dillards.com|m|mw|dept|all|US|-
belk|Belk|belk.com|m|mw|dept|all|US|-
walmart|Walmart|walmart.com|v|mw|casual|all|US|-
amazon|Amazon|amazon.com|v|mw|market|all|US|-|https://www.amazon.com/s?k={q}
tjmaxx|TJ Maxx|tjmaxx.tjx.com|v|mw|dept|all|US|-
marshalls|Marshalls|marshalls.com|v|mw|dept|all|US|-
nordstromrack|Nordstrom Rack|nordstromrack.com|v|mw|dept|all|US|-
burlington|Burlington|burlington.com|v|mw|casual|all|US|-
fashionnova|Fashion Nova|fashionnova.com|v|w|trend|clothes|US|-
prettylittlething|PrettyLittleThing|prettylittlething.us|v|w|trend|clothes|US|-
boohoo|boohoo|boohoo.com|v|mw|trend|all|US,GB,AU|-
nastygal|Nasty Gal|nastygal.com|v|w|trend|clothes|US,GB|-
revolve|Revolve|revolve.com|p|mw|trend|all|US|-
shopbop|Shopbop|shopbop.com|p|w|polished|all|US|-
anthropologie|Anthropologie|anthropologie.com|p|w|boho|all|US,CA,GB|-
urbanoutfitters|Urban Outfitters|urbanoutfitters.com|m|mw|trend|all|US,CA,GB|-
freepeople|Free People|freepeople.com|m|w|boho|all|US,CA,GB|-
abercrombie|Abercrombie & Fitch|abercrombie.com|m|mw|casual|all|US,CA,GB,DE,FR,IT,ES|-
hollister|Hollister|hollisterco.com|v|mw|casual|clothes|US,CA,GB,DE,FR,IT,ES|-
americaneagle|American Eagle|ae.com|v|mw|casual|all|US,CA|-
pacsun|PacSun|pacsun.com|m|mw|street|all|US|-
zumiez|Zumiez|zumiez.com|m|mw|street|all|US,CA|-
hottopic|Hot Topic|hottopic.com|v|mw|street|clothes|US|-
forever21|Forever 21|forever21.com|v|mw|fast|all|US|-
express|Express|express.com|m|mw|polished|clothes|US|-
loft|LOFT|loft.com|m|w|classic|clothes|US|-
anntaylor|Ann Taylor|anntaylor.com|m|w|classic|clothes|US|-
talbots|Talbots|talbots.com|m|w|classic|clothes|US|-
chicos|Chico's|chicos.com|m|w|boho|clothes|US|-
eddiebauer|Eddie Bauer|eddiebauer.com|m|mw|outdoor|sport|US|-
llbean|L.L.Bean|llbean.com|m|mw|outdoor|sport|US|-
landsend|Lands' End|landsend.com|m|mw|classic|clothes|US|-
rei|REI Co-op|rei.com|m|mw|outdoor|sport|US|-
dickssporting|DICK'S Sporting Goods|dickssportinggoods.com|m|mw|sport|sport|US|-
footlocker|Foot Locker|footlocker.com|m|mw|sport|sport|US,CA,GB,DE,FR,IT,ES|-
jdsports|JD Sports|jdsports.com|m|mw|sport|sport|US,CA,GB,DE,FR,IT,ES,AU|-
journeys|Journeys|journeys.com|m|mw|street|shoes|US|-
dsw|DSW|dsw.com|v|mw|casual|shoes|US|-
famousfootwear|Famous Footwear|famousfootwear.com|v|mw|casual|shoes|US|-
zappos|Zappos|zappos.com|m|mw|casual|all|US|-
athleta|Athleta|athleta.gap.com|m|w|sport|sport|US|-
outdoorvoices|Outdoor Voices|outdoorvoices.com|m|mw|sport|sport|US|-
madewell|Madewell|madewell.com|m|mw|casual|all|US|-
bananarepublic|Banana Republic|bananarepublic.gap.com|m|mw|classic|all|US|-
jcrew|J.Crew|jcrew.com|m|mw|prep|all|US|-
everlane|Everlane|everlane.com|m|mw|basics|all|US|-
oldnavy|Old Navy|oldnavy.gap.com|v|mw|casual|all|US|-
target|Target|target.com|v|mw|casual|all|US|-
nordstrom|Nordstrom|nordstrom.com|p|mw|dept|all|US|-
gapfactory|Gap Factory|gapfactory.com|v|mw|casual|clothes|US|-
bonobos|Bonobos|bonobos.com|m|m|prep|menswear|US|-
brooksbrothers|Brooks Brothers|brooksbrothers.com|p|mw|classic|all|US|-
menswearhouse|Men's Wearhouse|menswearhouse.com|m|m|classic|menall|US|-
josbank|JoS. A. Bank|josbank.com|m|m|classic|menall|US|-
toddsnyder|Todd Snyder|toddsnyder.com|p|m|polished|menall|US|-
buckmason|Buck Mason|buckmason.com|m|m|basics|menswear|US|-
huckberry|Huckberry|huckberry.com|m|m|outdoor|menall|US|-
vineyardvines|Vineyard Vines|vineyardvines.com|m|mw|prep|clothes|US|-
lillypulitzer|Lilly Pulitzer|lillypulitzer.com|p|w|prep|clothes|US|-
tommybahama|Tommy Bahama|tommybahama.com|p|mw|prep|clothes|US|-
aritzia|Aritzia|aritzia.com|m|w|polished|clothes|US,CA|CA
lulus|Lulus|lulus.com|v|w|trend|clothes|US|-
windsor|Windsor|windsorstore.com|v|w|trend|clothes|US|-
thredup|ThredUp|thredup.com|v|mw|market|all|US|-|https://www.thredup.com/products?search_text={q}
therealreal|The RealReal|therealreal.com|p|mw|luxury|all|US|-
colehaan|Cole Haan|colehaan.com|p|mw|classic|shoes|US,CA,GB|-
sorel|SOREL|sorel.com|m|mw|outdoor|shoes|US,CA|-

# ── Canada ──
simons|Simons|simons.ca|m|mw|dept|all|CA|CA
thebay|Hudson's Bay|thebay.com|m|mw|dept|all|CA|CA
roots|Roots|roots.com|m|mw|casual|all|CA,US|CA
joefresh|Joe Fresh|joefresh.com|v|mw|basics|clothes|CA|CA
reitmans|Reitmans|reitmans.com|v|w|classic|clothes|CA|-
winners|Winners|winners.ca|v|mw|dept|all|CA|CA
marks|Mark's|marks.com|v|mw|outdoor|menall|CA|-
sportchek|Sport Chek|sportchek.ca|m|mw|sport|sport|CA|CA
holtrenfrew|Holt Renfrew|holtrenfrew.com|p|mw|luxury|all|CA|-
ardene|Ardene|ardene.com|v|w|trend|all|CA|-
garage|Garage|garageclothing.com|v|w|trend|clothes|CA|-
dynamite|Dynamite|dynamiteclothing.com|v|w|trend|clothes|CA|-
bluenotes|Bluenotes|bluenotes.com|v|mw|casual|clothes|CA|-
lechateau|Le Château|lechateau.com|m|mw|polished|clothes|CA|-
frankandoak|Frank And Oak|frankandoak.com|m|mw|basics|clothes|CA|-
canadagoose|Canada Goose|canadagoose.com|p|mw|outdoor|sport|CA,US,GB|-
amazonca|Amazon Canada|amazon.ca|v|mw|market|all|CA|-|https://www.amazon.ca/s?k={q}
walmartca|Walmart Canada|walmart.ca|v|mw|casual|all|CA|-
brownsshoes|Browns Shoes|brownsshoes.com|m|mw|polished|shoes|CA|-

# ── United Kingdom ──
marksandspencer|Marks & Spencer|marksandspencer.com|m|mw|classic|all|GB|GB
next|Next|next.co.uk|m|mw|classic|all|GB|GB
johnlewis|John Lewis|johnlewis.com|m|mw|dept|all|GB|GB
selfridges|Selfridges|selfridges.com|p|mw|luxury|all|GB|-
harrods|Harrods|harrods.com|p|mw|luxury|all|GB|-
flannels|Flannels|flannels.com|p|mw|luxury|all|GB|-
debenhams|Debenhams|debenhams.com|m|mw|dept|all|GB|-
riverisland|River Island|riverisland.com|v|mw|trend|all|GB|GB
newlook|New Look|newlook.com|v|mw|fast|all|GB|GB
tkmaxx|TK Maxx|tkmaxx.com|v|mw|dept|all|GB|GB
sportsdirect|Sports Direct|sportsdirect.com|v|mw|sport|sport|GB|-
schuh|schuh|schuh.co.uk|m|mw|street|shoes|GB|-
office|OFFICE|office.co.uk|m|mw|trend|shoes|GB|-
dunelondon|Dune London|dunelondon.com|m|w|polished|shoes|GB|-
hobbs|Hobbs|hobbs.com|m|w|classic|clothes|GB|-
whistles|Whistles|whistles.com|p|w|polished|clothes|GB|-
reiss|Reiss|reiss.com|p|mw|polished|clothes|GB|-
allsaints|AllSaints|allsaints.com|p|mw|street|all|GB,US,CA,DE,FR|-
tedbaker|Ted Baker|tedbaker.com|p|mw|polished|clothes|GB,US|-
superdry|Superdry|superdry.com|m|mw|street|all|GB,DE,FR,ES,IT,NL|-
fatface|FatFace|fatface.com|m|mw|casual|all|GB|-
joules|Joules|joules.com|m|mw|prep|all|GB|-
boden|Boden|boden.com|m|mw|classic|all|GB,US|-
monsoon|Monsoon|monsoon.co.uk|m|w|boho|clothes|GB|-
phaseeight|Phase Eight|phase-eight.com|m|w|classic|clothes|GB|-
karenmillen|Karen Millen|karenmillen.com|m|w|polished|clothes|GB,US|-
oasis|Oasis|oasisfashion.com|v|w|trend|clothes|GB|-
warehouse|Warehouse|warehousefashion.com|v|w|trend|clothes|GB|-
dorothyperkins|Dorothy Perkins|dorothyperkins.com|v|w|classic|clothes|GB|-
ctshirts|Charles Tyrwhitt|ctshirts.com|m|m|classic|menswear|GB,US|-
moss|Moss|moss.co.uk|m|m|classic|menall|GB|-
jigsaw|Jigsaw|jigsaw-online.com|p|mw|polished|clothes|GB|-
mintvelvet|Mint Velvet|mintvelvet.co.uk|m|w|classic|clothes|GB|-
whitestuff|White Stuff|whitestuff.com|m|mw|casual|all|GB|-
seasalt|Seasalt Cornwall|seasaltcornwall.co.uk|m|mw|casual|all|GB|-
hush|HUSH|hush-uk.com|m|w|casual|all|GB|-
meandem|ME+EM|meandem.com|p|w|minimal|clothes|GB|-
ghost|Ghost|ghost.co.uk|m|w|boho|clothes|GB|-
barbour|Barbour|barbour.com|p|mw|outdoor|all|GB,US|-
hunter|Hunter|hunterboots.com|m|mw|outdoor|shoes|GB,US|-
fredperry|Fred Perry|fredperry.com|m|mw|street|all|GB,US|-
george|George at Asda|direct.asda.com|v|mw|basics|all|GB|GB
tesco|Tesco F&F|tesco.com|v|mw|basics|clothes|GB|-
tuclothing|Tu Clothing|tuclothing.sainsburys.co.uk|v|mw|basics|clothes|GB|-
matalan|Matalan|matalan.co.uk|v|mw|basics|all|GB|-
very|Very|very.co.uk|v|mw|market|all|GB|-
littlewoods|Littlewoods|littlewoods.com|v|mw|market|all|GB|-
simplybe|Simply Be|simplybe.co.uk|v|w|casual|clothes|GB|-
joebrowns|Joe Browns|joebrowns.co.uk|m|mw|boho|clothes|GB|-
cotswoldoutdoor|Cotswold Outdoor|cotswoldoutdoor.com|m|mw|outdoor|sport|GB|-
gooutdoors|GO Outdoors|gooutdoors.co.uk|v|mw|outdoor|sport|GB|-
mountainwarehouse|Mountain Warehouse|mountainwarehouse.com|v|mw|outdoor|sport|GB|-
trespass|Trespass|trespass.com|v|mw|outdoor|sport|GB|-
jdsportsuk|JD Sports UK|jdsports.co.uk|m|mw|sport|sport|GB|-
amazonuk|Amazon UK|amazon.co.uk|v|mw|market|all|GB|-|https://www.amazon.co.uk/s?k={q}
prettylittlethinguk|PrettyLittleThing UK|prettylittlething.com|v|w|trend|clothes|GB|-
mandco|M&Co|mandco.com|v|mw|basics|all|GB|-
peacocks|Peacocks|peacocks.co.uk|v|mw|basics|all|GB|-
bonmarche|Bonmarché|bonmarche.co.uk|v|w|classic|clothes|GB|-
evans|Evans|evans.co.uk|v|w|casual|clothes|GB|-
burton|Burton|burton.co.uk|v|m|classic|menall|GB|-
lyleandscott|Lyle & Scott|lyleandscott.com|m|mw|prep|clothes|GB,US|-
orlakiely|Orla Kiely|orlakiely.com|p|w|boho|clothes|GB|-

# ── Germany, Austria, Switzerland ──
zalandode|Zalando|zalando.de|m|mw|market|all|DE|DE
aboutyou|ABOUT YOU|aboutyou.de|v|mw|trend|all|DE|DE
otto|OTTO|otto.de|v|mw|market|all|DE|DE
breuninger|Breuninger|breuninger.com|p|mw|dept|all|DE|-
peekcloppenburg|Peek & Cloppenburg|peek-cloppenburg.de|m|mw|dept|all|DE|DE
cunda|C&A|c-and-a.com|v|mw|basics|all|DE,NL|DE,NL
soliver|s.Oliver|soliver.com|m|mw|casual|clothes|DE|-
tomtailor|TOM TAILOR|tom-tailor.com|v|mw|casual|clothes|DE|-
bonprix|bonprix|bonprix.de|v|mw|basics|clothes|DE|-
mytheresa|Mytheresa|mytheresa.com|p|mw|luxury|all|DE|-
engelhorn|Engelhorn|engelhorn.de|m|mw|dept|all|DE|-
galeria|GALERIA|galeria.de|v|mw|dept|all|DE|-
orsay|Orsay|orsay.com|v|w|fast|clothes|DE|-
gerryweber|GERRY WEBER|gerryweber.com|m|w|classic|clothes|DE|-
drykorn|DRYKORN|drykorn.com|p|mw|polished|clothes|DE|-
armedangels|ARMEDANGELS|armedangels.com|m|mw|basics|clothes|DE|-
deichmann|Deichmann|deichmann.com|v|mw|casual|shoes|DE,FR,ES,IT,PT,NL,TR|-
goertz|Görtz|goertz.de|m|mw|classic|shoes|DE|-
amazonde|Amazon Germany|amazon.de|v|mw|market|all|DE|-|https://www.amazon.de/s?k={q}
sportscheck|SportScheck|sportscheck.com|m|mw|sport|sport|DE|-
tchibo|Tchibo|tchibo.de|v|mw|basics|clothes|DE|-
walbusch|Walbusch|walbusch.de|m|m|classic|menswear|DE|-
marccain|Marc Cain|marc-cain.com|p|w|polished|clothes|DE|-
hessnatur|hessnatur|hessnatur.com|m|mw|basics|clothes|DE|-
bogner|BOGNER|bogner.com|p|mw|luxury|all|DE|-
joop|JOOP!|joop.com|p|mw|polished|all|DE|-
strellson|Strellson|strellson.com|m|m|classic|menswear|DE|-
tamaris|Tamaris|tamaris.com|m|w|trend|shoes|DE|-
ludwigbeck|Ludwig Beck|ludwigbeck.de|p|mw|luxury|all|DE|-

# ── France ──
zalandofr|Zalando|zalando.fr|m|mw|market|all|FR|FR
galerieslafayette|Galeries Lafayette|galerieslafayette.com|p|mw|dept|all|FR|FR
printemps|Printemps|printemps.com|p|mw|dept|all|FR|-
laredoute|La Redoute|laredoute.fr|m|mw|basics|all|FR|FR
kiabi|Kiabi|kiabi.com|v|mw|basics|clothes|FR|FR
celio|Celio|celio.com|v|m|basics|menswear|FR|FR
jules|Jules|jules.com|v|m|casual|menswear|FR|-
promod|Promod|promod.fr|v|w|casual|clothes|FR|-
comptoirdescotonniers|Comptoir des Cotonniers|comptoirdescotonniers.com|m|w|polished|clothes|FR|-
ikks|IKKS|ikks.com|m|mw|street|clothes|FR|-
petitbateau|Petit Bateau|petit-bateau.fr|m|mw|basics|clothes|FR|-
leslipfrancais|Le Slip Français|leslipfrancais.fr|m|m|basics|menswear|FR|-
decathlonfr|Decathlon France|decathlon.fr|v|mw|sport|sport|FR|FR
intersport|Intersport|intersport.fr|m|mw|sport|sport|FR|-
eram|Éram|eram.fr|v|mw|casual|shoes|FR|-
pimkie|Pimkie|pimkie.fr|v|w|trend|clothes|FR|-
bonobo|Bonobo|bonobo-jeans.com|v|mw|casual|clothes|FR|-
etam|Etam|etam.com|v|w|classic|clothes|FR|-
undiz|Undiz|undiz.com|v|w|fast|clothes|FR|-
devred|Devred|devred.com|v|m|classic|menswear|FR|-
cachecache|Cache Cache|cache-cache.fr|v|w|fast|clothes|FR|-
amazonfr|Amazon France|amazon.fr|v|mw|market|all|FR|-|https://www.amazon.fr/s?k={q}
cdiscount|Cdiscount|cdiscount.com|v|mw|market|all|FR|-
okaidi|Okaïdi|okaidi.fr|m|mw|basics|clothes|FR|-
agnesb|agnès b.|agnesb.com|p|mw|minimal|clothes|FR|-
thekooples|The Kooples|thekooples.com|p|mw|street|clothes|FR|-
bensimon|Bensimon|bensimon.com|m|mw|casual|clothes|FR|-
caroll|Caroll|caroll.com|m|w|classic|clothes|FR|-
naf|Naf Naf|nafnaf.com|v|w|fast|clothes|FR|-
jonak|Jonak|jonak.com|m|w|polished|shoes|FR|-
minelli|Minelli|minelli.fr|m|w|trend|shoes|FR|-

# ── Spain ──
elcorteingles|El Corte Inglés|elcorteingles.es|m|mw|dept|all|ES|ES
zalandoes|Zalando|zalando.es|m|mw|market|all|ES|ES
cortefiel|Cortefiel|cortefiel.com|m|mw|classic|clothes|ES|-
womensecret|women'secret|womensecret.com|m|w|casual|clothes|ES|-
springfield|Springfield|springfield.com|v|mw|casual|clothes|ES|ES
scalpers|Scalpers|scalperscompany.com|m|mw|prep|clothes|ES|-
hossintropia|Hoss Intropia|hossintropia.com|p|w|boho|clothes|ES|-
sfera|Sfera|sfera.com|v|mw|fast|clothes|ES|-
lefties|Lefties|lefties.com|v|mw|fast|all|ES,PT|ES
bimbaylola|Bimba y Lola|bimbaylola.com|m|w|trend|all|ES|-
pedrodelhierro|Pedro del Hierro|pedrodelhierro.com|m|mw|classic|clothes|ES|-
amazones|Amazon España|amazon.es|v|mw|market|all|ES,PT|-|https://www.amazon.es/s?k={q}
decathlones|Decathlon España|decathlon.es|v|mw|sport|sport|ES|ES
mayoral|Mayoral|mayoral.com|m|mw|basics|clothes|ES|-
adolfodominguez|Adolfo Domínguez|adolfodominguez.com|p|mw|minimal|clothes|ES|-
panamajack|Panama Jack|panamajack.com|m|mw|outdoor|shoes|ES|-
misako|Misako|misako.com|m|w|trend|bags|ES|-
tous|TOUS|tous.com|m|w|trend|bags|ES|-
sportzone|Sprinter|sprintersports.com|m|mw|sport|sport|ES|-
deportesmillan|Forum Sport|forumsport.com|m|mw|sport|sport|ES|-
privalia|Privalia|privalia.com|v|mw|market|all|ES|-
carolinaherrera|Carolina Herrera|carolinaherrera.com|p|w|luxury|all|ES|-

# ── Italy ──
zalandoit|Zalando|zalando.it|m|mw|market|all|IT|IT
ovs|OVS|ovs.it|v|mw|basics|all|IT|IT
calzedonia|Calzedonia|calzedonia.com|v|w|basics|clothes|IT|-
intimissimi|Intimissimi|intimissimi.com|m|w|basics|clothes|IT|-
falconeri|Falconeri|falconeri.com|m|mw|classic|clothes|IT|-
terranova|Terranova|terranovastyle.com|v|mw|fast|clothes|IT|-
piazzaitalia|Piazza Italia|piazzaitalia.it|v|mw|fast|clothes|IT|-
motivi|Motivi|motivi.com|v|w|trend|clothes|IT|-
liujo|Liu Jo|liujo.com|m|w|trend|all|IT|-
patriziapepe|Patrizia Pepe|patriziapepe.com|p|w|polished|clothes|IT|-
pinko|PINKO|pinko.com|p|w|polished|all|IT|-
twinset|TWINSET|twinset.com|m|w|polished|clothes|IT|-
brunellocucinelli|Brunello Cucinelli|brunellocucinelli.com|p|mw|luxury|all|IT|-
luisaviaroma|LUISAVIAROMA|luisaviaroma.com|p|mw|luxury|all|IT|-
boggi|BOGGI MILANO|boggi.com|m|m|classic|menall|IT|-
dolcegabbana|Dolce&Gabbana|dolcegabbana.com|p|mw|luxury|all|IT|-
tods|Tod's|tods.com|p|mw|luxury|all|IT|-
amazonit|Amazon Italia|amazon.it|v|mw|market|all|IT|-|https://www.amazon.it/s?k={q}
decathlonit|Decathlon Italia|decathlon.it|v|mw|sport|sport|IT|IT
coin|Coin|coin.it|m|mw|dept|all|IT|-
rinascente|La Rinascente|rinascente.it|p|mw|luxury|all|IT|-
tezenis|Tezenis|tezenis.com|v|mw|fast|clothes|IT|-
carpisa|Carpisa|carpisa.it|m|w|trend|bags|IT|-
bata|Bata|bata.com|v|mw|casual|shoes|IT|-
stonefly|Stonefly|stonefly.com|m|mw|casual|shoes|IT|-
refrigiwear|RefrigiWear|refrigiwear.com|m|mw|outdoor|sport|IT|-
kway|K-Way|k-way.com|m|mw|outdoor|sport|IT|-
slamjam|Slam Jam|slamjam.com|m|mw|street|all|IT|-
alcott|Alcott|alcott.eu|v|mw|fast|clothes|IT|-
originalmarines|Original Marines|originalmarines.com|v|mw|basics|clothes|IT|-
sportler|Sportler|sportler.com|m|mw|outdoor|sport|IT|-

# ── Portugal ──
sacoor|Sacoor Brothers|sacoorbrothers.com|m|mw|polished|clothes|PT|PT
parfois|Parfois|parfois.com|v|w|trend|bags|PT|-
salsajeans|Salsa Jeans|salsajeans.com|m|mw|casual|clothes|PT|-
lanidor|Lanidor|lanidor.com|m|w|classic|clothes|PT|-
fashionclinic|Fashion Clinic|fashionclinic.com|p|mw|luxury|all|PT|-
elcorteinglespt|El Corte Inglés Portugal|elcorteingles.pt|m|mw|dept|all|PT|PT
sportzonept|Sport Zone|sportzone.pt|v|mw|sport|sport|PT|PT
decathlonpt|Decathlon Portugal|decathlon.pt|v|mw|sport|sport|PT|PT
tiffosi|Tiffosi|tiffosi.com|m|mw|trend|clothes|PT|-
josefinas|Josefinas|josefinas.com|m|w|polished|shoes|PT|-

# ── Netherlands ──
zalandonl|Zalando|zalando.nl|m|mw|market|all|NL|NL
wehkamp|Wehkamp|wehkamp.nl|v|mw|market|all|NL|NL
debijenkorf|de Bijenkorf|debijenkorf.nl|p|mw|dept|all|NL|-
hema|HEMA|hema.nl|v|mw|basics|clothes|NL|-
wefashion|WE Fashion|wefashion.nl|v|mw|fast|all|NL|NL
amazonnl|Amazon Netherlands|amazon.nl|v|mw|market|all|NL|-|https://www.amazon.nl/s?k={q}
decathlonnl|Decathlon Nederland|decathlon.nl|v|mw|sport|sport|NL|NL
sissy|Sissy-Boy|sissy-boy.com|m|mw|casual|clothes|NL|-
costes|Costes|costesfashion.com|m|w|polished|clothes|NL|-
vanharen|Van Haren|vanharen.nl|v|mw|casual|shoes|NL|-
omoda|Omoda|omoda.nl|m|mw|casual|shoes|NL|-
sacha|Sacha|sacha.nl|v|mw|casual|shoes|NL|-
missetam|Miss Etam|missetam.nl|v|w|classic|clothes|NL|-
jcsnl|America Today|americantoday.com|v|mw|casual|clothes|NL|-
denham|Denham|denhamthejeanmaker.com|p|mw|street|clothes|NL|-
nikkie|NIKKIE|nikkie.com|m|w|street|clothes|NL|-
tigerofsweden|Tiger of Sweden|tigerofsweden.com|p|mw|polished|clothes|NL|-
bol|bol|bol.com|v|mw|market|all|NL|-

# ── Türkiye ──
trendyol|Trendyol|trendyol.com|v|mw|market|all|TR|TR
hepsiburada|Hepsiburada|hepsiburada.com|v|mw|market|all|TR|TR
n11|n11|n11.com|v|mw|market|all|TR|-
boyner|Boyner|boyner.com.tr|m|mw|dept|all|TR|TR
lcwaikiki|LC Waikiki|lcw.com|v|mw|basics|all|TR|TR
defacto|DeFacto|defacto.com.tr|v|mw|fast|all|TR|TR
koton|Koton|koton.com|v|mw|fast|all|TR|TR
mavi|Mavi|mavi.com|m|mw|casual|clothes|TR|TR
colins|Colin's|colins.com.tr|v|mw|casual|clothes|TR|-
network|Network|network.com.tr|m|mw|polished|clothes|TR|-
beymen|Beymen|beymen.com|p|mw|luxury|all|TR|-
vakko|Vakko|vakko.com|p|mw|luxury|all|TR|-
flo|FLO|flo.com.tr|v|mw|casual|shoes|TR|TR
ipekyol|İpekyol|ipekyol.com.tr|m|w|polished|clothes|TR|-
mudo|Mudo|mudo.com.tr|m|mw|casual|clothes|TR|-
penti|Penti|penti.com|v|w|basics|clothes|TR|-
sarar|Sarar|sarar.com|m|m|classic|menall|TR|-
damat|Damat|damattweed.com.tr|m|m|classic|menall|TR|-
altinyildiz|Altınyıldız Classics|altinyildizclassics.com|m|m|classic|menall|TR|-
kigili|Kiğılı|kigili.com|m|m|classic|menall|TR|-
adl|ADL|adl.com.tr|m|w|trend|clothes|TR|-
machka|Machka|machka.com.tr|m|w|polished|clothes|TR|-
ltbjeans|LTB Jeans|ltbjeans.com|m|mw|casual|clothes|TR|-
pierrecardin|Pierre Cardin|pierrecardin.com.tr|m|mw|classic|clothes|TR|-
dagi|DAGİ|dagi.com.tr|v|mw|casual|clothes|TR|-
greyder|Greyder|greyder.com|m|m|classic|menall|TR|-
perspective|Perspective|perspective.com.tr|m|w|polished|clothes|TR|-
yargici|Yargıcı|yargici.com|m|w|classic|clothes|TR|-
fabrika|Fabrika|fabrika.com.tr|v|mw|fast|clothes|TR|-
quzu|Quzu|quzu.com.tr|m|w|polished|clothes|TR|-
amazontr|Amazon Türkiye|amazon.com.tr|v|mw|market|all|TR|-|https://www.amazon.com.tr/s?k={q}
decathlontr|Decathlon Türkiye|decathlon.com.tr|v|mw|sport|sport|TR|TR
sportive|Sportive|sportive.com.tr|m|mw|sport|sport|TR|-
hummel|Hummel|hummel.com.tr|v|mw|sport|sport|TR|-
kinetix|Kinetix|kinetix.com.tr|v|mw|casual|shoes|TR|-
hotic|Hotiç|hotic.com.tr|m|mw|classic|shoes|TR|-
derimod|Derimod|derimod.com.tr|m|mw|classic|all|TR|-
desa|Desa|desa.com.tr|m|mw|classic|all|TR|-
modanisa|Modanisa|modanisa.com|v|w|classic|clothes|TR|-
ciceksepeti|Çiçeksepeti|ciceksepeti.com|v|mw|market|all|TR|-

# ── Australia ──
theiconic|THE ICONIC|theiconic.com.au|m|mw|trend|all|AU|AU
davidjones|David Jones|davidjones.com|p|mw|dept|all|AU|AU
myer|Myer|myer.com.au|m|mw|dept|all|AU|AU
cottonon|Cotton On|cottonon.com|v|mw|fast|all|AU|AU
countryroad|Country Road|countryroad.com.au|m|mw|polished|all|AU|AU
witchery|Witchery|witchery.com.au|m|w|polished|clothes|AU|-
ripcurl|Rip Curl|ripcurl.com|m|mw|casual|clothes|AU|-
billabong|Billabong|billabong.com|m|mw|casual|clothes|AU|-
rebel|rebel|rebelsport.com.au|m|mw|sport|sport|AU|AU
kmartau|Kmart|kmart.com.au|v|mw|basics|all|AU|AU
bigw|BIG W|bigw.com.au|v|mw|basics|all|AU|-
targetau|Target Australia|target.com.au|v|mw|basics|all|AU|-
glassons|Glassons|glassons.com|v|w|fast|clothes|AU|-
princesspolly|Princess Polly|princesspolly.com|v|w|trend|clothes|AU,US|-
showpo|Showpo|showpo.com|v|w|trend|clothes|AU|-
lornajane|Lorna Jane|lornajane.com|m|w|sport|sport|AU|-
sportsgirl|Sportsgirl|sportsgirl.com.au|v|w|trend|clothes|AU|-
seedheritage|Seed Heritage|seedheritage.com|m|mw|polished|clothes|AU|-
bonds|Bonds|bonds.com.au|v|mw|basics|clothes|AU|-
bardot|Bardot|bardot.com.au|m|w|trend|clothes|AU|-
universalstore|Universal Store|universalstore.com|v|mw|street|clothes|AU|-
culturekings|Culture Kings|culturekings.com.au|m|mw|street|all|AU|-
platypus|Platypus Shoes|platypusshoes.com.au|m|mw|street|shoes|AU|-
hypedc|HYPE DC|hypedc.com|m|mw|street|shoes|AU|-
generalpants|General Pants|generalpants.com.au|v|mw|street|clothes|AU|-
jeanswest|Jeanswest|jeanswest.com.au|v|mw|casual|clothes|AU|-
aje|Aje|aje.com.au|p|w|polished|clothes|AU|-
zimmermann|Zimmermann|zimmermannwear.com|p|w|boho|clothes|AU|-
ksubi|Ksubi|ksubi.com|p|mw|street|clothes|AU|-
assemblylabel|Assembly Label|assemblylabel.com|m|mw|minimal|clothes|AU|-
cue|CUE|cue.com.au|m|w|polished|clothes|AU|-
rmwilliams|R.M.Williams|rmwilliams.com.au|p|mw|classic|all|AU|-
amazonau|Amazon Australia|amazon.com.au|v|mw|market|all|AU|-|https://www.amazon.com.au/s?k={q}
kathmandu|Kathmandu|kathmandu.com.au|m|mw|outdoor|sport|AU|-
macpac|Macpac|macpac.com.au|m|mw|outdoor|sport|AU|-
anaconda|Anaconda|anaconda.com.au|m|mw|outdoor|sport|AU|-
bcf|BCF|bcf.com.au|v|mw|outdoor|sport|AU|-
wittner|Wittner|wittner.com.au|m|w|classic|shoes|AU|-
hushpuppiesau|Hush Puppies Australia|hushpuppies.com.au|m|mw|casual|shoes|AU|-
typo|Typo|typo.com|v|mw|trend|bags|AU|-
suitshop|Politix|politix.com.au|m|m|polished|menswear|AU|-

# ── Brazil ──
renner|Lojas Renner|lojasrenner.com.br|m|mw|fast|all|BR|BR
cea|C&A Brasil|cea.com.br|v|mw|basics|all|BR|BR
riachuelo|Riachuelo|riachuelo.com.br|v|mw|fast|all|BR|BR
marisa|Marisa|marisa.com.br|v|mw|basics|all|BR|-
zattini|Zattini|zattini.com.br|m|mw|trend|all|BR|BR
netshoes|Netshoes|netshoes.com.br|m|mw|sport|sport|BR|BR
dafiti|Dafiti|dafiti.com.br|m|mw|trend|all|BR|BR
arezzo|Arezzo|arezzo.com.br|m|w|polished|shoes|BR|-
farm|FARM Rio|farmrio.com.br|p|w|boho|clothes|BR|-
havaianas|Havaianas|havaianas.com.br|v|mw|casual|shoes|BR|-
hering|Hering|hering.com.br|v|mw|basics|clothes|BR|-
reserva|Reserva|usereserva.com|p|m|prep|menall|BR|-
animale|Animale|animale.com.br|p|w|polished|clothes|BR|-
amazonbr|Amazon Brasil|amazon.com.br|v|mw|market|all|BR|-|https://www.amazon.com.br/s?k={q}
mercadolivre|Mercado Livre|mercadolivre.com.br|v|mw|market|all|BR|-
centauro|Centauro|centauro.com.br|m|mw|sport|sport|BR|BR
decathlonbr|Decathlon Brasil|decathlon.com.br|v|mw|sport|sport|BR|-
shoulder|Shoulder|shoulder.com.br|p|w|polished|clothes|BR|-
colcci|Colcci|colcci.com.br|m|mw|trend|clothes|BR|-
schutz|Schutz|schutz.com.br|p|w|polished|shoes|BR|-
lojasamericanas|Americanas|americanas.com.br|v|mw|market|all|BR|-
magazineluiza|Magazine Luiza|magazineluiza.com.br|v|mw|market|all|BR|-
casasbahia|Casas Bahia|casasbahia.com.br|v|mw|market|all|BR|-

# ── Mexico ──
liverpool|Liverpool|liverpool.com.mx|m|mw|dept|all|MX|MX
palaciodehierro|El Palacio de Hierro|elpalaciodehierro.com|p|mw|dept|all|MX|MX
suburbia|Suburbia|suburbia.com.mx|v|mw|basics|all|MX|MX
coppel|Coppel|coppel.com|v|mw|basics|all|MX|MX
searsmx|Sears México|sears.com.mx|m|mw|dept|all|MX|-
cyamx|C&A México|cyamoda.com|v|mw|basics|all|MX|MX
mercadolibre|Mercado Libre|mercadolibre.com.mx|v|mw|market|all|MX|-
amazonmx|Amazon México|amazon.com.mx|v|mw|market|all|MX|-|https://www.amazon.com.mx/s?k={q}
andrea|Andrea|andrea.com|v|mw|casual|shoes|MX|-
cuidadoconelperro|Cuidado con el Perro|cuidadoconelperro.com.mx|m|m|polished|menall|MX|-
dportenis|Dportenis|dportenis.mx|m|mw|sport|sport|MX|-
innovasport|Innovasport|innovasport.com|m|mw|sport|sport|MX|-
decathlonmx|Decathlon México|decathlon.com.mx|v|mw|sport|sport|MX|-
walmartmx|Walmart México|walmart.com.mx|v|mw|basics|all|MX|-
`;

/**
 * Parse the table into retailer objects (without the hand-tuned details of the first few stores, which retailers.js
 * layers on top).
 * @returns {object[]}
 */
export function parseStores() {
  const seen = new Set();
  const out = [];
  for (const raw of ROWS.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [id, name, domain, tier, dep, style, carries, regions, core, search] = line.split('|');
    if (!id || !name || !domain || !STYLES[style] || !CARRIES[carries]) throw new Error(`store-data: bad row: ${line}`);
    if (seen.has(id)) continue; // a store listed twice keeps its first row
    seen.add(id);
    out.push({
      id,
      name,
      domain,
      tier: { v: 'value', m: 'mid', p: 'premium' }[tier],
      departments: dep === 'mw' ? ['men', 'women'] : dep === 'w' ? ['women'] : ['men'],
      styles: STYLES[style],
      carries: CARRIES[carries],
      regions: regions === '*' ? ['*'] : regions.split(','),
      core: core && core !== '-' ? core.split(',') : [],
      search: search || null
    });
  }
  return out;
}
