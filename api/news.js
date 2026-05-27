const CATEGORY_LABELS = {
  destacados: "Selección editorial",
  curiosidades: "Curiosidades",
  rural: "Vida rural",
  comer: "Comer bien",
  sitios: "Sitios con encanto",
  estilo: "Pelo & rastas",
  negocios: "Negocios locales"
};

function googleNews(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es&gl=ES&ceid=ES:es`;
}

const FEEDS = [
  {
    category: "sitios",
    source: "Sitios con encanto",
    url: googleNews("(Aragón OR Navarra OR Zaragoza OR Pamplona OR Huesca OR Teruel) (pueblos bonitos OR ruta OR mirador OR senderismo OR escapada OR naturaleza OR visitar OR patrimonio OR cascada OR castillo OR monasterio) -política -gobierno -elecciones -partido")
  },
  {
    category: "comer",
    source: "Comer bien",
    url: googleNews("(Zaragoza OR Aragón OR Navarra OR Pamplona OR Huesca OR Teruel) (restaurante OR bar OR tapas OR gastronomía OR cocina OR menú OR terraza OR producto local OR dónde comer OR comer bien) -política -gobierno -elecciones")
  },
  {
    category: "rural",
    source: "Vida rural",
    url: googleNews("(Aragón OR Navarra OR Zaragoza OR Huesca OR Teruel OR Pamplona) (agricultura OR ganadería OR granja OR huerto OR cultivo OR aceite OR queso OR huevos OR cooperativa OR venta directa OR producto local OR pueblo) -política -gobierno -elecciones -protesta")
  },
  {
    category: "rural",
    source: "Campo y producto local",
    url: googleNews("(España OR Aragón OR Navarra) (pequeña granja OR agricultura regenerativa OR huerto ecológico OR obrador OR agroturismo OR turismo rural OR producto de cercanía OR venta directa) -política -gobierno -elecciones")
  },
  {
    category: "negocios",
    source: "Negocios locales",
    url: googleNews("(pequeño comercio OR negocio local OR emprendedores OR emprendimiento rural OR tienda local OR barbería OR peluquería OR restaurante pequeño OR comercio de barrio) (marketing OR digital OR redes sociales OR fidelización OR innovación OR comunidad) -política -gobierno -elecciones")
  },
  {
    category: "estilo",
    source: "Pelo y rastas",
    url: googleNews("(peluquería OR barbería OR rastas OR dreadlocks OR corte de pelo OR barba OR cabello OR peinado) (tendencia OR cuidado OR consejos OR estilo OR mantenimiento OR hidratación) -política -famosos -televisión")
  },
  {
    category: "curiosidades",
    source: "Curiosidades",
    url: googleNews("(curiosidades OR historia curiosa OR ciencia curiosa OR naturaleza OR animales curiosidades OR patrimonio curioso OR origen de) -política -gobierno -elecciones -guerra")
  }
];

const NEGATIVE_WORDS = [
  "política", "politica", "gobierno", "elecciones", "electoral", "partido",
  "congreso", "senado", "parlamento", "ministro", "ministra", "presidente",
  "presidenta", "alcalde", "alcaldesa", "psoe", "pp", "vox", "sumar",
  "podemos", "sánchez", "sanchez", "feijóo", "feijoo", "trump", "biden",
  "ucrania", "rusia", "israel", "hamas", "guerra", "ataque", "muerte",
  "muerto", "asesinato", "violencia", "tribunal", "juzgado", "corrupción",
  "corrupcion", "manifestación", "manifestacion", "huelga", "protesta",
  "delito", "detenido", "detenida", "accidente mortal"
];

const POSITIVE_WORDS = {
  sitios: [
    "ruta", "rutas", "escapada", "mirador", "senderismo", "naturaleza",
    "pueblo", "pueblos", "visitar", "patrimonio", "parque", "montaña",
    "cascada", "castillo", "monasterio", "turismo"
  ],
  comer: [
    "restaurante", "bar", "tapas", "comer", "gastronomía", "gastronomia",
    "cocina", "menú", "menu", "producto local", "terraza", "cafetería",
    "chef", "asador", "bodega", "brasa"
  ],
  rural: [
    "agricultura", "ganadería", "ganaderia", "granja", "granjas", "huerto",
    "cultivo", "cultivos", "regadío", "regadio", "tractor", "aceite",
    "queso", "huevos", "producto local", "cooperativa", "venta directa",
    "agroturismo", "turismo rural", "obrador", "pueblo", "campo",
    "ecológico", "ecologico"
  ],
  negocios: [
    "negocio", "negocios", "emprendedor", "emprendedores", "emprendimiento",
    "pequeño comercio", "tienda", "local", "barbería", "barberia",
    "peluquería", "peluqueria", "marketing", "digital", "redes sociales",
    "fidelización", "comunidad", "marca"
  ],
  estilo: [
    "peluquería", "peluqueria", "barbería", "barberia", "rastas",
    "dreadlocks", "cabello", "pelo", "barba", "corte", "fade", "peinado",
    "tendencia", "cuidado", "hidratación", "mantenimiento"
  ],
  curiosidades: [
    "curiosidad", "curiosidades", "ciencia", "historia", "naturaleza",
    "animales", "patrimonio", "descubren", "descubrimiento", "sorprendente",
    "origen", "por qué", "por que"
  ]
};

const FALLBACK_NEWS = [
  {
    id: "fallback-sitios-1",
    title: "Sitios con encanto para guardar y visitar sin complicarse",
    summary: "Miradores, pueblos bonitos, rutas cortas y paradas con buen ambiente. Una sección pensada para encontrar planes reales, no solo titulares.",
    url: "https://www.google.com/search?q=sitios+con+encanto+Arag%C3%B3n+Navarra+rutas+pueblos+bonitos",
    image: "",
    source: "Selección",
    category: "sitios",
    categoryLabel: "Sitios con encanto",
    date: new Date().toISOString()
  },
  {
    id: "fallback-comer-1",
    title: "Bares y restaurantes con producto local que merecen ficha",
    summary: "Ideas para descubrir sitios donde comer bien: tapas, menús, cocina de cercanía, terrazas y lugares con historia.",
    url: "https://www.google.com/search?q=bares+restaurantes+producto+local+Zaragoza+Navarra+Arag%C3%B3n",
    image: "",
    source: "Selección",
    category: "comer",
    categoryLabel: "Comer bien",
    date: new Date().toISOString()
  },
  {
    id: "fallback-rural-1",
    title: "Pequeñas granjas, huertos y negocios de pueblo con futuro",
    summary: "Campo, agricultura, venta directa, obradores y proyectos rurales contados desde una mirada útil e inspiradora.",
    url: "https://www.google.com/search?q=agricultura+granjas+negocios+rurales+Arag%C3%B3n+Navarra",
    image: "",
    source: "Selección rural",
    category: "rural",
    categoryLabel: "Vida rural",
    date: new Date().toISOString()
  },
  {
    id: "fallback-estilo-1",
    title: "Rastas, barba y corte: mantenimiento que se nota",
    summary: "Consejos e ideas de estilo para que el pelo, la barba o las rastas no dependan solo del primer día de peluquería.",
    url: "https://www.google.com/search?q=cuidados+rastas+barba+corte+pelo",
    image: "",
    source: "Selección estilo",
    category: "estilo",
    categoryLabel: "Pelo & rastas",
    date: new Date().toISOString()
  },
  {
    id: "fallback-negocios-1",
    title: "Ideas de negocio local que pueden inspirar a pequeños comercios",
    summary: "Marketing sencillo, comunidad, reservas, fidelización y contenido útil para que un negocio pequeño parezca más vivo y cercano.",
    url: "https://www.google.com/search?q=ideas+negocio+local+peque%C3%B1o+comercio+marketing",
    image: "",
    source: "Selección negocios",
    category: "negocios",
    categoryLabel: "Negocios locales",
    date: new Date().toISOString()
  }
];

function normalizeText(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanText(text = "") {
  return String(text)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(value) {
  const str = String(value || "");
  let hash = 0;

  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }

  return hash.toString(16);
}

function getTagValue(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return cleanText(match?.[1] || "");
}

function getMediaImage(xml) {
  const enclosure = xml.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosure?.[1]) return enclosure[1];

  const mediaContent = xml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaContent?.[1]) return mediaContent[1];

  const mediaThumbnail = xml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (mediaThumbnail?.[1]) return mediaThumbnail[1];

  const img = xml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img?.[1]) return img[1];

  return "";
}

function parseRssItems(xml) {
  const items = [];
  const matches = String(xml).match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of matches) {
    const title = getTagValue(itemXml, "title");
    const link = getTagValue(itemXml, "link");
    const description = getTagValue(itemXml, "description");
    const pubDate = getTagValue(itemXml, "pubDate");
    const guid = getTagValue(itemXml, "guid");

    if (!title || !link) continue;

    items.push({
      title,
      link,
      description,
      pubDate,
      guid,
      image: getMediaImage(itemXml)
    });
  }

  return items;
}

function hasNegativeNoise(item) {
  const hay = normalizeText(`${item.title || ""} ${item.description || ""}`);
  return NEGATIVE_WORDS.some((word) => hay.includes(normalizeText(word)));
}

function scoreItem(item, category) {
  const hay = normalizeText(`${item.title || ""} ${item.description || ""}`);
  const terms = POSITIVE_WORDS[category] || [];
  let score = 0;

  for (const term of terms) {
    if (hay.includes(normalizeText(term))) score += 2;
  }

  if (item.image) score += 1;
  if (item.pubDate) score += 1;

  return score;
}

function smartSummary(item, category) {
  const original = cleanText(item.description || "");
  const base = original && original.length > 45 ? original : "";

  const templates = {
    sitios: "Idea para guardar: puede servir para una escapada corta, una tarde distinta o descubrir un sitio bonito cerca.",
    comer: "Recomendación gastronómica para fichar bares, restaurantes, producto local o sitios donde parar a comer bien.",
    rural: "Pieza sobre campo, agricultura, pequeñas granjas, producto local o negocio rural que puede dar ideas útiles y cercanas.",
    negocios: "Contenido útil para pequeños negocios: inspiración, marketing, comercio local, comunidad y formas sencillas de vender mejor.",
    estilo: "Contenido de estilo, pelo, barbería, rastas o cuidado personal que puede encajar con la comunidad de la app.",
    curiosidades: "Curiosidad para leer rápido y aprender algo distinto sin entrar en ruido político ni titulares densos."
  };

  const chosen = base || templates[category] || "Contenido seleccionado para leer rápido y descubrir algo útil.";
  return chosen.length > 240 ? `${chosen.slice(0, 237).trim()}...` : chosen;
}

function normalizeItem(item, feed) {
  const score = scoreItem(item, feed.category);
  const rawKey = item.guid || item.link || `${feed.category}-${feed.source}-${item.title}`;

  return {
    id: `${feed.category}-${makeId(rawKey)}`,
    title: cleanText(item.title || "Contenido destacado"),
    summary: smartSummary(item, feed.category),
    url: item.link || "",
    image: item.image || "",
    source: feed.source,
    category: feed.category,
    categoryLabel: CATEGORY_LABELS[feed.category] || feed.source,
    date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    score
  };
}

function removeDuplicates(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = normalizeText(item.title)
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .slice(0, 90);

    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out;
}

async function loadFeed(feed) {
  try {
    const response = await fetch(feed.url, {
      headers: {
        "User-Agent": "RastaCutsActualidad/3.0"
      }
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const items = parseRssItems(xml);

    return items
      .slice(0, 12)
      .filter((item) => item.title && item.link)
      .filter((item) => !hasNegativeNoise(item))
      .map((item) => normalizeItem(item, feed))
      .filter((item) => item.score > 0 || ["comer", "estilo", "sitios", "rural", "negocios"].includes(feed.category));
  } catch (error) {
    return [];
  }
}

export default async function handler(req, res) {
  try {
    const category = String(req?.query?.category || "todo").toLowerCase();
    const selectedFeeds = category === "todo"
      ? FEEDS
      : FEEDS.filter((feed) => feed.category === category);

    const feedsToUse = selectedFeeds.length ? selectedFeeds : FEEDS;
    const chunks = await Promise.all(feedsToUse.map((feed) => loadFeed(feed)));

    const news = removeDuplicates(chunks.flat())
      .sort((a, b) => {
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.date) - new Date(a.date);
      })
      .slice(0, 28)
      .map(({ score, ...item }) => item);

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=7200");
    res.status(200).json({
      ok: true,
      mode: "curated-community-no-deps",
      count: news.length,
      categories: CATEGORY_LABELS,
      news: news.length ? news : FALLBACK_NEWS
    });
  } catch (error) {
    res.status(200).json({
      ok: false,
      mode: "fallback",
      error: "No se pudieron cargar las fuentes curadas.",
      categories: CATEGORY_LABELS,
      news: FALLBACK_NEWS
    });
  }
}
