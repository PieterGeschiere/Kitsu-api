const USER_ID = "1266153";
const API = "https://kitsu.io/api/edge";
const PAGE_SIZE = 200; // Kitsu's maximum for library entries
const HIDDEN_AGE_RATINGS = new Set(["R", "R18"]);
const PER_PAGE = 30;

const FORMAT_LABELS = {
  TV: "TV",
  movie: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  special: "Special",
  music: "Music",
};

const els = {
  grid: document.getElementById("grid"),
  state: document.getElementById("state"),
  count: document.getElementById("result-count"),
  pagination: document.getElementById("pagination"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  filters: document.getElementById("filters"),
  stats: document.getElementById("stats"),
  detail: document.getElementById("detail"),
};

const view = { query: "", type: "all", sort: "rating", page: 1 };
let library = [];

/* ---------- Data ---------- */

function libraryUrl(offset) {
  const params = new URLSearchParams({
    "filter[status]": "completed",
    sort: "-rating",
    include: "anime",
    "page[limit]": PAGE_SIZE,
    "page[offset]": offset,
    "fields[libraryEntries]": "ratingTwenty,progress,createdAt,anime",
    "fields[anime]":
      "canonicalTitle,synopsis,posterImage,ageRating,startDate,episodeCount,subtype,averageRating,slug",
  });
  return `${API}/users/${USER_ID}/library-entries?${params}`;
}

async function fetchLibrary() {
  const entries = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const res = await fetch(libraryUrl(offset));
    if (!res.ok) throw new Error(`Kitsu responded with ${res.status}`);
    const json = await res.json();

    const animeById = new Map((json.included || []).map((a) => [a.id, a.attributes]));
    for (const entry of json.data) {
      const anime = animeById.get(entry.relationships.anime.data?.id);
      if (anime) entries.push(toItem(entry, anime));
    }

    total = json.meta.count;
    offset += PAGE_SIZE;
  }

  return entries.filter((item) => !HIDDEN_AGE_RATINGS.has(item.ageRating));
}

function toItem(entry, anime) {
  const rating = entry.attributes.ratingTwenty;
  return {
    title: anime.canonicalTitle,
    synopsis: anime.synopsis || "No synopsis available.",
    poster: anime.posterImage?.medium || anime.posterImage?.small || "",
    posterLarge: anime.posterImage?.large || anime.posterImage?.medium || "",
    ageRating: anime.ageRating,
    year: anime.startDate ? Number(anime.startDate.slice(0, 4)) : null,
    episodes: anime.episodeCount,
    type: anime.subtype,
    community: anime.averageRating ? Number(anime.averageRating) : null,
    slug: anime.slug,
    myRating: rating ? rating / 2 : null, // ratingTwenty is 2-20, shown out of 10
    progress: entry.attributes.progress || 0,
    addedAt: entry.attributes.createdAt ? Date.parse(entry.attributes.createdAt) : 0,
  };
}

/* ---------- Rendering ---------- */

function formatScore(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function metaLine(item) {
  const parts = [];
  if (item.year) parts.push(item.year);
  if (item.type) parts.push(FORMAT_LABELS[item.type] || item.type);
  if (item.episodes > 1) parts.push(`${item.episodes} eps`);
  return parts.join(" · ");
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderCard(item) {
  const li = el("li");
  const button = el("button", "card");
  button.type = "button";

  const poster = el("div", "card-poster");
  const img = el("img");
  img.src = item.poster;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  poster.append(img);

  if (item.myRating) {
    const score = el("span", "card-score", formatScore(item.myRating));
    score.setAttribute("aria-label", `My rating ${formatScore(item.myRating)} out of 10`);
    poster.append(score);
  }

  button.append(poster, el("p", "card-title", item.title), el("p", "card-meta", metaLine(item)));
  button.addEventListener("click", () => openDetail(item));
  li.append(button);
  return li;
}

function renderSkeleton(count = 18) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const li = el("li");
    const card = el("div", "card is-skeleton");
    card.setAttribute("aria-hidden", "true");
    card.append(el("div", "card-poster"), el("div", "bar"), el("div", "bar"));
    li.append(card);
    frag.append(li);
  }
  els.grid.replaceChildren(frag);
}

const sorters = {
  rating: (a, b) => (b.myRating ?? 0) - (a.myRating ?? 0) || (b.community ?? 0) - (a.community ?? 0),
  added: (a, b) => b.addedAt - a.addedAt,
  community: (a, b) => (b.community ?? 0) - (a.community ?? 0),
  newest: (a, b) => (b.year ?? 0) - (a.year ?? 0),
  oldest: (a, b) => (a.year ?? 9999) - (b.year ?? 9999),
  title: (a, b) => a.title.localeCompare(b.title),
};

function render() {
  const q = view.query.trim().toLowerCase();
  const items = library
    .filter((item) => view.type === "all" || item.type === view.type)
    .filter((item) => !q || item.title.toLowerCase().includes(q))
    .sort(sorters[view.sort]);

  const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE));
  view.page = Math.min(view.page, pageCount);
  const start = (view.page - 1) * PER_PAGE;
  const pageItems = items.slice(start, start + PER_PAGE);

  els.grid.replaceChildren(...pageItems.map(renderCard));
  els.count.textContent =
    items.length > PER_PAGE
      ? `${start + 1}–${start + pageItems.length} of ${items.length} titles`
      : `${items.length} of ${library.length} titles`;
  renderPagination(pageCount);

  if (items.length === 0) {
    showState("Nothing matches that search.", { image: true });
  } else {
    els.state.hidden = true;
  }
}

// Page numbers to show: first, last, and a window around the current page.
function pageList(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

function renderPagination(pageCount) {
  els.pagination.hidden = pageCount <= 1;
  if (pageCount <= 1) return els.pagination.replaceChildren();

  const button = (label, page, { current = false, disabled = false, aria } = {}) => {
    const b = el("button", "page-btn", label);
    b.type = "button";
    b.dataset.page = page;
    b.disabled = disabled;
    if (current) b.setAttribute("aria-current", "page");
    if (aria) b.setAttribute("aria-label", aria);
    return b;
  };

  const nodes = [button("Prev", view.page - 1, { disabled: view.page === 1, aria: "Previous page" })];
  for (const p of pageList(view.page, pageCount)) {
    nodes.push(
      p === null
        ? el("span", "page-gap", "…")
        : button(String(p), p, { current: p === view.page, aria: `Page ${p}` })
    );
  }
  nodes.push(button("Next", view.page + 1, { disabled: view.page === pageCount, aria: "Next page" }));
  els.pagination.replaceChildren(...nodes);
}

function renderStats() {
  const set = (key, value) => {
    els.stats.querySelector(`[data-stat="${key}"]`).textContent = value.toLocaleString();
  };
  set("titles", library.length);
  set("episodes", library.reduce((sum, item) => sum + item.progress, 0));
  set("perfect", library.filter((item) => item.myRating === 10).length);
}

function renderFilters() {
  const types = [...new Set(library.map((item) => item.type).filter(Boolean))];
  const order = Object.keys(FORMAT_LABELS);
  types.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  for (const type of types) {
    const chip = el("button", "chip", FORMAT_LABELS[type] || type);
    chip.type = "button";
    chip.dataset.type = type;
    els.filters.append(chip);
  }
}

function showState(message, { image = false, retry = false } = {}) {
  els.state.replaceChildren();
  if (image) {
    const img = el("img");
    img.src = "./assets/img/Chibi%20marine.png";
    img.alt = "";
    els.state.append(img);
  }
  els.state.append(el("p", null, message));
  if (retry) {
    const button = el("button", null, "Try again");
    button.type = "button";
    button.addEventListener("click", load);
    els.state.append(button);
  }
  els.state.hidden = false;
}

/* ---------- Detail dialog ---------- */

function openDetail(item) {
  const $ = (id) => document.getElementById(id);

  $("detail-poster").src = item.posterLarge;
  $("detail-title").textContent = item.title;
  $("detail-meta").textContent = metaLine(item);
  $("detail-synopsis").textContent = item.synopsis;
  $("detail-link").href = `https://kitsu.app/anime/${item.slug}`;

  const scores = $("detail-scores");
  scores.replaceChildren();
  const addScore = (label, value) => {
    const wrap = el("div");
    wrap.append(el("dt", null, label), el("dd", null, value));
    scores.append(wrap);
  };
  addScore("My rating", item.myRating ? `${formatScore(item.myRating)} / 10` : "Unrated");
  addScore("Community", item.community ? `${item.community.toFixed(0)}%` : "n/a");
  addScore("Episodes watched", item.progress.toLocaleString());
  if (item.addedAt) {
    addScore(
      "Added",
      new Date(item.addedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    );
  }

  els.detail.showModal();
}

// Close when clicking the backdrop
els.detail.addEventListener("click", (event) => {
  if (event.target === els.detail) els.detail.close();
});

/* ---------- Controls ---------- */

let searchTimer;
els.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    view.query = els.search.value;
    view.page = 1;
    render();
  }, 120);
});

/* Custom sort dropdown (listbox pattern) */

const sortUi = {
  trigger: document.getElementById("sort-trigger"),
  menu: document.getElementById("sort-menu"),
  current: document.getElementById("sort-current"),
  options: [...document.querySelectorAll("#sort-menu [role='option']")],
  focused: 0,
};

sortUi.options.forEach((opt, i) => (opt.id = `sort-opt-${i}`));

function focusOption(index) {
  const count = sortUi.options.length;
  sortUi.focused = (index + count) % count;
  sortUi.options.forEach((opt, i) => opt.classList.toggle("is-focused", i === sortUi.focused));
  sortUi.menu.setAttribute("aria-activedescendant", sortUi.options[sortUi.focused].id);
  sortUi.options[sortUi.focused].scrollIntoView({ block: "nearest" });
}

function openSort() {
  sortUi.menu.hidden = false;
  sortUi.trigger.setAttribute("aria-expanded", "true");
  focusOption(sortUi.options.findIndex((o) => o.dataset.value === view.sort));
  sortUi.menu.focus();
}

function closeSort({ returnFocus = true } = {}) {
  if (sortUi.menu.hidden) return;
  sortUi.menu.hidden = true;
  sortUi.trigger.setAttribute("aria-expanded", "false");
  if (returnFocus) sortUi.trigger.focus();
}

function chooseSort(option) {
  sortUi.options.forEach((o) => o.setAttribute("aria-selected", String(o === option)));
  sortUi.current.textContent = option.textContent;
  closeSort();
  if (view.sort === option.dataset.value) return;
  view.sort = option.dataset.value;
  view.page = 1;
  render();
}

sortUi.trigger.addEventListener("click", () => (sortUi.menu.hidden ? openSort() : closeSort()));

sortUi.trigger.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openSort();
  }
});

sortUi.menu.addEventListener("click", (event) => {
  const option = event.target.closest("[role='option']");
  if (option) chooseSort(option);
});

sortUi.menu.addEventListener("mousemove", (event) => {
  const option = event.target.closest("[role='option']");
  if (option) focusOption(sortUi.options.indexOf(option));
});

sortUi.menu.addEventListener("keydown", (event) => {
  const keys = {
    ArrowDown: () => focusOption(sortUi.focused + 1),
    ArrowUp: () => focusOption(sortUi.focused - 1),
    Home: () => focusOption(0),
    End: () => focusOption(sortUi.options.length - 1),
    Enter: () => chooseSort(sortUi.options[sortUi.focused]),
    " ": () => chooseSort(sortUi.options[sortUi.focused]),
    Escape: () => closeSort(),
    Tab: () => closeSort({ returnFocus: false }),
  };
  if (!keys[event.key]) return;
  if (event.key !== "Tab") event.preventDefault();
  keys[event.key]();
});

document.addEventListener("pointerdown", (event) => {
  if (!els.sort.contains(event.target)) closeSort({ returnFocus: false });
});

els.pagination.addEventListener("click", (event) => {
  const btn = event.target.closest(".page-btn");
  if (!btn || btn.disabled) return;
  view.page = Number(btn.dataset.page);
  render();
  const top = els.count.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: Math.max(0, top) });
});

els.filters.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  els.filters.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === chip));
  view.type = chip.dataset.type;
  view.page = 1;
  render();
});

/* ---------- Boot ---------- */

async function load() {
  els.state.hidden = true;
  els.count.textContent = "Loading library…";
  renderSkeleton();

  try {
    library = await fetchLibrary();
  } catch (err) {
    console.error(err);
    els.grid.replaceChildren();
    els.count.textContent = "";
    showState("Couldn't reach Kitsu right now.", { retry: true });
    return;
  }

  if (els.filters.children.length === 1) renderFilters();
  renderStats();
  render();
}

load();
