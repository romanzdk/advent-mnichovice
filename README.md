# Advent za rohem

Statický český průvodce adventními akcemi v Mnichovicích a okolí pro sezonu 2026.

## Web

- Chronologický seznam a mapa Leaflet / OpenStreetMap.
- Vyhledávání a filtry podle obce, typu a termínu.
- Odkazy na primární pořadatele, rezervace a navigaci.
- Jednotlivé kalendářní soubory ICS bez pozvánek a osobních údajů.
- Nezveřejněné/rozporné hodiny a přibližné mapové polohy jsou označeny.
- Vícedenní výstava není tvrzením, že je otevřená každý den; ověřte otevírací dobu u pořadatele.

## Data a soukromí

`site/events.json` obsahuje jen explicitně povolená veřejná fakta od pořadatelů. Není exportem osobního kalendáře. Interní evidenci, pozvánky, e-maily a odpovědi hostů projekt nepřijímá ani nezveřejňuje. Bez analytiky, cookies a klientského geokódování. Mapa načítá podkladové dlaždice od OpenStreetMap, kterému návštěvník přímo odesílá požadavek.

Polohy v `data/locations.json` byly jednorázově dohledány přes Nominatim, s cache a limitem nejvýše jeden požadavek za sekundu. Každá poloha odkazuje na zdrojový objekt OSM. Poloha `town` je jen orientační střed obce, ne místo konání. Body `venue` představují ověřené odpovídající objekty/adresy. Data map: © OpenStreetMap contributors, ODbL. Leaflet 1.9.4: BSD-2-Clause, licence ve `site/vendor/LEAFLET-LICENSE.txt`.

## Publikování

Push do `main` spouští GitHub Actions: testy exportu, testy frontendových funkcí, validaci veřejných dat a publikování **pouze adresáře `site/`** na GitHub Pages. Není potřeba release tag ani backend. Cloudflare lze připojit později; není předpokladem provozu.

Sběr a ověřování dat zajišťuje oddělený denní průzkum. Není provozován z webového prohlížeče ani z GitHub Actions. Při změně se z interní evidence vytvoří bezpečná veřejná projekce pomocí `scripts/export_events.py` a zkontroluje `scripts/validate_public.py`. Kontrola schématu a soukromí musí předcházet commitu.

## Vývoj

```sh
python3 -m unittest discover -s tests -v
node --test tests-ui/helpers.test.mjs
python3 scripts/validate_public.py site/events.json
python3 -m http.server 8080 --directory site
```

Pro izolované prohlížečové testy: `npm install --prefix tests-ui`, potom `npm test --prefix tests-ui`. Vyžadují soukromý Playwright Chromium, ne osobní relaci prohlížeče.

Export veřejné projekce (soukromý vstup zůstává mimo repozitář):

```sh
python3 scripts/export_events.py --state /path/to/private-input.json --locations data/locations.json --out site/events.json
python3 scripts/validate_public.py site/events.json
```

Zápis v průvodci není rezervací ani zárukou volných míst. Před cestou zkontrolujte původní zdroj.
