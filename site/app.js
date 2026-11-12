import { filterEvents, timeLabel, safeHttps, periodBounds, groupLocations, eventIcs } from './helpers.js';

const $ = id => document.getElementById(id);
const categories = { strom: 'Rozsvícení stromu', mikulas: 'Mikuláš', trhy: 'Trhy a jarmarky', tvoreni: 'Tvoření', setkani: 'Setkání', betlem: 'Betlémy' };
const dateFormat = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Europe/Prague' });
const dayFormat = new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', timeZone: 'Europe/Prague' });
const monthFormat = new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'Europe/Prague' });
let events = [];
let visibleEvents = [];
let map, markerLayer, mapPromise;
let tileFailed = false;
const desktop = matchMedia('(min-width: 821px)');

function selectEvent(id) {
  setView('list');
  for (const card of document.querySelectorAll('.event-card')) {
    const selected = card.dataset.id === id;
    card.classList.toggle('selected', selected);
    if (selected) {
      const top = window.scrollY + card.getBoundingClientRect().top - 24;
      window.scrollTo({ top, behavior: 'instant' });
      card.focus({ preventScroll: true });
    }
  }
}
function updateMap() {
  const groups = groupLocations(visibleEvents);
  const mappedCount = groups.reduce((sum, group) => sum + group.events.length, 0);
  $('map-count').textContent = `${groups.length} ${groups.length === 1 ? 'místo' : groups.length < 5 ? 'místa' : 'míst'}`;
  if (!map) return;
  markerLayer.clearLayers();
  const bounds = [];
  for (const group of groups) {
    const popup = el('div', null, 'map-popup');
    popup.append(el('h3', group.label));
    if (group.precision === 'town') popup.append(el('p', 'Pouze střed obce, nikoli přesné místo konání.'));
    for (const event of group.events) {
      const button = el('button', `${dateFormat.format(dateValue(event.date))} · ${event.title}`, 'popup-event');
      button.type = 'button';
      button.addEventListener('click', () => { map.closePopup(); selectEvent(event.id); });
      popup.append(button);
    }
    const marker = globalThis.L.circleMarker([group.lat, group.lon], { radius: 22, color: '#fffdf7', weight: 2, fillColor: '#244b3c', fillOpacity: .87, className: 'map-marker' }).addTo(markerLayer);
    marker.bindPopup(popup, { maxWidth: 280 });
    const path = marker.getElement();
    path.setAttribute('tabindex', '0');
    path.setAttribute('role', 'button');
    path.setAttribute('aria-label', `${group.label}: ${group.events.length} ${group.events.length === 1 ? 'akce' : 'akcí'}`);
    path.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); marker.openPopup(); }
    });
    bounds.push([group.lat, group.lon]);
  }
  if (bounds.length) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13, animate: false });
  const unmapped = visibleEvents.length - mappedCount;
  $('map-notice').textContent = tileFailed ? 'Mapový podklad se nepodařilo načíst. Body a seznam akcí zůstávají dostupné.' : unmapped ? `${unmapped} akcí nemá polohu; najdete je v seznamu.` : 'Vyberte bod pro akce v daném místě.';
}
async function ensureMap() {
  if (map) { map.invalidateSize(); return; }
  if (mapPromise) return mapPromise;
  mapPromise = (async () => {
    try {
      await import('./vendor/leaflet.js');
      const L = globalThis.L;
      if (!L?.map) throw new Error('Map library unavailable');
      map = L.map('map', { scrollWheelZoom: false, zoomControl: true }).setView([49.936, 14.711], 11);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        maxZoom: 18, minZoom: 8, keepBuffer: 1, updateWhenIdle: true
      });
      tiles.on('tileerror', () => {
        tileFailed = true;
        $('map-notice').textContent = 'Mapový podklad se nepodařilo načíst. Body a seznam akcí zůstávají dostupné.';
      });
      tiles.addTo(map);
      markerLayer = L.layerGroup().addTo(map);
      const observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe($('map'));
      updateMap();
    } catch {
      $('map-notice').textContent = 'Mapu se nepodařilo načíst. Všechny akce najdete v seznamu.';
    }
  })();
  return mapPromise;
}
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function publicLink(text, value, className) {
  const href = safeHttps(value);
  if (!href) return null;
  const link = el('a', text, className);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
function dateValue(value) { return new Date(value.length === 10 ? `${value}T12:00:00Z` : value); }
function card(event) {
  const article = el('article', null, 'event-card');
  article.dataset.id = event.id;
  article.tabIndex = -1;
  const date = dateValue(event.date);
  const rail = el('div', null, 'date-rail');
  const time = el('time'); time.dateTime = event.date;
  time.append(el('span', dayFormat.format(date)), el('strong', String(date.getUTCDate())), el('span', new Intl.DateTimeFormat('cs-CZ', { month: 'short', timeZone: 'Europe/Prague' }).format(date)));
  rail.append(time);
  const body = el('div', null, 'event-body');
  const badges = el('div', null, 'badges');
  badges.append(el('span', categories[event.category] || 'Akce', 'category-badge'));
  if (event.audience !== 'všichni') badges.append(el('span', event.audience === 'dospělí' ? 'Dospělí' : 'Senioři / omezené zaměření', 'audience-badge'));
  if (event.status === 'cancelled') badges.append(el('span', 'Zrušeno', 'warning-badge'));
  body.append(badges, el('h3', event.title), el('p', [event.town, event.venue].filter(Boolean).join(' · '), 'event-place'));
  const timing = el('p', timeLabel(event), event.startTime ? 'event-time' : 'event-time uncertain');
  if (event.endDate && event.endDate !== event.date) timing.append(document.createTextNode(` · do ${dateFormat.format(dateValue(event.endDate))}`));
  body.append(timing);
  if (event.description) body.append(el('p', event.description, 'event-description'));
  const facts = el('p', event.price || 'Vstupné neuvedeno', 'event-facts');
  if (event.registration) facts.append(document.createTextNode(` · ${event.registration}`));
  const booking = publicLink('Rezervace u pořadatele ↗', event.registrationUrl, 'booking-link');
  if (booking) { facts.append(document.createTextNode(' · '), booking); }
  body.append(facts);
  if (event.notes?.length) {
    const notes = el('ul', null, 'event-notes');
    for (const note of event.notes) notes.append(el('li', note));
    body.append(notes);
  }
  if (event.location?.precision === 'town') body.append(el('p', 'Poloha na mapě: pouze střed obce.', 'location-note'));
  const actions = el('div', null, 'event-actions');
  const source = publicLink('Zdroj a podrobnosti ↗', event.sourceUrl, 'source-link');
  if (source) actions.append(source);
  else actions.append(el('span', 'Zdroj není dostupný', 'muted'));
  if (groupLocations([event]).length) {
    const url = new URL('https://www.openstreetmap.org/directions');
    url.searchParams.set('to', `${event.location.lat},${event.location.lon}`);
    const navigation = publicLink(event.location.precision === 'town' ? 'Do obce ↗' : 'Navigovat ↗', url.href, 'navigation-link');
    navigation.title = event.location.precision === 'town' ? 'Navigace do středu obce; přesné místo ověřte u pořadatele' : 'Navigace na místo konání';
    actions.append(navigation);
  }
  const calendar = el('button', 'Do kalendáře (.ics)', 'calendar-button');
  calendar.type = 'button';
  calendar.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([eventIcs(event)], { type: 'text/calendar;charset=utf-8' }));
    const download = el('a');
    download.href = url;
    download.download = `advent-${String(event.id).replace(/[^a-zA-Z0-9_-]/g, '')}.ics`;
    download.hidden = true;
    document.body.append(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
  actions.append(calendar);
  body.append(actions);
  const verified = dateValue(event.verifiedAt);
  if (!Number.isNaN(verified.getTime())) body.append(el('p', `Ověřeno ${dateFormat.format(verified)}`, 'verified'));
  article.append(rail, body);
  return article;
}
function render() {
  const filters = Object.fromEntries(new FormData($('filters')));
  const visible = filterEvents(events, filters);
  const fragment = document.createDocumentFragment();
  if (!visible.length) {
    const empty = el('div', null, 'empty-state state-message');
    empty.append(el('h3', 'Žádná akce pro tento výběr'), el('p', 'Zkuste jiný termín, obec nebo zrušte filtry.'));
    fragment.append(empty);
  }
  let month;
  for (const event of visible) {
    if (event.date.slice(0, 7) !== month) {
      month = event.date.slice(0, 7);
      fragment.append(el('h2', monthFormat.format(dateValue(event.date)), 'month-heading'));
    }
    fragment.append(card(event));
  }
  $('results').replaceChildren(fragment);
  $('results').setAttribute('aria-busy', 'false');
  const bounds = periodBounds(filters.period);
  const period = bounds ? `${dateFormat.format(dateValue(bounds[0]))}–${dateFormat.format(dateValue(bounds[1]))}` : 'všechny termíny';
  $('result-count').textContent = `${visible.length} ${visible.length === 1 ? 'akce' : visible.length < 5 ? 'akce' : 'akcí'} · ${period}`;
  visibleEvents = visible;
  updateMap();
}
function setView(view) {
  $('explore').dataset.view = view;
  $('show-list').setAttribute('aria-pressed', String(view === 'list'));
  $('show-map').setAttribute('aria-pressed', String(view === 'map'));
  if (view === 'map' || desktop.matches) ensureMap();
}
desktop.addEventListener('change', () => { if (desktop.matches) ensureMap(); });
$('show-list').addEventListener('click', () => setView('list'));
$('show-map').addEventListener('click', () => setView('map'));
$('filters').addEventListener('submit', event => event.preventDefault());
$('filters').addEventListener('input', render);
$('filters').addEventListener('change', render);
$('filters').addEventListener('reset', event => {
  event.preventDefault();
  $('search').value = '';
  $('period').value = 'all';
  $('category').value = '';
  $('town').value = '';
  render();
});
function validData(data) {
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
  const time = value => value === null || typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  return data?.schemaVersion === 1 && Array.isArray(data.events) && Number.isFinite(Date.parse(data.generatedAt)) && data.events.every(event =>
    event && typeof event.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(event.id) &&
    typeof event.title === 'string' && typeof event.town === 'string' && date(event.date) &&
    (event.endDate === null || date(event.endDate) && event.endDate >= event.date) && time(event.startTime) && time(event.endTime) &&
    typeof event.description === 'string' && Array.isArray(event.notes) && event.notes.every(note => typeof note === 'string') &&
    Object.hasOwn(categories, event.category) && ['všichni', 'dospělí', 'senioři / omezené zaměření'].includes(event.audience) &&
    ['confirmed', 'time-unconfirmed', 'cancelled'].includes(event.status) && Number.isFinite(Date.parse(event.verifiedAt))
  ) && new Set(data.events.map(event => event.id)).size === data.events.length;
}
async function load() {
  for (const control of $('filters').elements) control.disabled = true;
  $('results').setAttribute('aria-busy', 'true');
  $('results').replaceChildren(el('p', 'Načítáme adventní akce…', 'state-message'));
  $('result-count').textContent = 'Načítáme přehled…';
  try {
    const response = await fetch(new URL('./events.json', import.meta.url), { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Přehled není dostupný');
    const data = await response.json();
    if (!validData(data)) throw new Error('Neplatný formát přehledu');
    events = data.events;
    const selectedTown = $('town').value;
    const allTowns = el('option', 'Všechny obce'); allTowns.value = '';
    $('town').replaceChildren(allTowns);
    for (const town of [...new Set(events.map(event => event.town))].sort((a, b) => a.localeCompare(b, 'cs'))) {
      const option = el('option', town); option.value = town; $('town').append(option);
    }
    $('town').value = selectedTown;
    if ($('town').selectedIndex < 0) $('town').value = '';
    $('data-updated').textContent = `Přehled aktualizován ${dateFormat.format(dateValue(data.generatedAt))}.`;
    for (const control of $('filters').elements) control.disabled = false;
    render();
    if (desktop.matches || $('explore').dataset.view === 'map') ensureMap();
  } catch {
    $('results').setAttribute('aria-busy', 'false');
    const error = el('div', null, 'load-error state-message');
    error.setAttribute('role', 'alert');
    error.append(el('h3', 'Přehled se nepodařilo načíst'), el('p', 'Zkontrolujte připojení a zkuste to znovu.'));
    const retry = el('button', 'Zkusit znovu');
    retry.type = 'button';
    retry.addEventListener('click', load);
    error.append(retry);
    $('results').replaceChildren(error);
    $('result-count').textContent = 'Přehled není dostupný';
    $('map-notice').textContent = 'Nejprve je potřeba načíst přehled akcí. Zkuste to znovu v seznamu.';
  }
}
load();
