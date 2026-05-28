// api/news.js
// Versión estable sin dependencias. No necesita rss-parser.
// FASE música: añade Reggae & rap clásico sin música comercial.

const CATEGORY_LABELS = {
  todo: "Todo",
  curiosidades: "Curiosidades",
  rural: "Vida rural",
  comer: "Comer bien",
  sitios: "Sitios con encanto",
  estilo: "Pelo & rastas",
  musica: "Reggae & rap clásico",
  negocios: "Negocios locales"
};

function googleNews(query) {
  return (
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(query) +
    "&hl=es&gl=ES&ceid=ES:es"
  );
}

const FEEDS = [
  {
    category: "sitios",
    source: "Sitios con encanto",
    url: googleNews(
      "(Aragón OR Navarra OR Zaragoza OR Pamplona OR Huesca OR Teruel) (pueblos bonitos OR ruta OR mirador OR senderismo OR escapada OR naturaleza OR visitar OR patrimonio OR cascada OR castillo OR monasterio) -política -gobierno -elecciones -partido"
    )
  },
  {
    category: "comer",
    source: "Comer bien",
    url: googleNews(
      "(Zaragoza OR Aragón OR Navarra OR Pamplona OR Huesca OR Teruel) (restaurante OR bar OR tapas OR gastronomía OR cocina OR menú OR terraza OR producto local OR dónde comer OR comer bien) -política -gobierno -elecciones"
    )
  },
  {
    category: "rural",
    source: "Vida rural",
    url: googleNews(
      "(Aragón OR Navarra OR Zaragoza OR Huesca OR Teruel OR Pamplona) (agricultura OR ganadería OR granja OR huerto OR cultivo OR aceite OR queso OR huevos OR cooperativa OR venta directa OR producto local OR pueblo) -política -gobierno -elecciones -protesta"
    )
  },
  {
    category: "rural",
    source: "Campo y producto local",
    url: googleNews(
      "(España OR Aragón OR Navarra) (pequeña granja OR agricultura regenerativa OR huerto ecológico OR obrador OR agroturismo OR turismo rural OR producto de cercanía OR venta directa) -política -gobierno -elecciones"
    )
  },
  {
    category: "negocios",
    source: "Negocios locales",
    url: googleNews(
      "(pequeño comercio OR negocio local OR emprendedores OR emprendimiento rural OR tienda local OR barbería OR peluquería OR restaurante pequeño OR comercio de barrio) (marketing OR digital OR redes sociales OR fidelización OR innovación OR comunidad) -política -gobierno -elecciones"
    )
  },
  {
    category: "estilo",
    source: "Pelo y rastas",
    url: googleNews(
      "(peluquería OR barbería OR rastas OR dreadlocks OR corte de pelo OR barba OR cabello OR peinado) (tendencia OR cuidado OR consejos OR estilo OR mantenimiento OR hidratación) -política -famosos -televisión"
    )
  },
  {
    category: "curiosidades",
    source: "Curiosidades",
    url: googleNews(
      "(curiosidades OR historia curiosa OR ciencia curiosa OR naturaleza OR animales curiosidades OR patrimonio curioso OR origen de) -política -gobierno -elecciones -guerra"
    )
  },
  {
    category: "musica",
    source: "Reggae & rap clásico",
    url: googleNews(
      '("Morodo" OR "Pure Negga" OR "Fyahbwoy" OR "Little Pepe" OR "Rapsusklei" OR "Kase.O" OR "Kase O" OR "Violadores del Verso" OR "Doble V" OR "Nach" OR "SFDK" OR "ToteKing" OR "Sho-Hai" OR "Sharif" OR "Xhelazz" OR "Juaninacka" OR "Falsalarma") (nuevo tema OR nueva canción OR nuevo single OR videoclip OR lanzamiento OR álbum OR disco OR EP OR gira OR concierto OR directo OR entrevista OR YouTube OR canal oficial) -LOS40 -Eurovisión -Benidorm -TikTok -influencer -reality -OT -famosos -televisión'
    )
  },
  {
    category: "musica",
    source: "Nuevos temas",
    url: googleNews(
      '("reggae español" OR "rap español clásico" OR "hip hop español" OR "reggae conscious" OR "rap underground") ("nuevo tema" OR "nuevo single" OR "videoclip oficial" OR "nuevo disco" OR "YouTube") -LOS40 -Eurovisión -Benidorm -TikTok -influencer -reality -OT -famosos -televisión -comercial'
    )
  }
];

const NEGATIVE_WORDS = [
  "política",
  "politica",
  "gobierno",
  "elecciones",
  "electoral",
  "partido",
  "congreso",
  "senado",
  "parlamento",
  "ministro",
  "ministra",
  "presidente",
  "presidenta",
  "alcalde",
  "alcaldesa",
  "psoe",
  "pp",
  "vox",
  "sumar",
  "podemos",
  "sánchez",
  "sanchez",
  "feijóo",
  "feijoo",
  "trump",
  "biden",
  "ucrania",
  "rusia",
  "israel",
  "hamas",
  "guerra",
  "ataque",
  "muerte",
  "muerto",
  "asesinato",
  "violencia",
  "tribunal",
  "juzgado",
  "corrupción",
  "corrupcion",
  "manifestación",
  "manifestacion",
  "huelga",
  "protesta",
  "delito",
  "detenido",
  "detenida",
  "accidente mortal",

  // Ruido musical comercial/mainstream que no interesa.
  "los40",
  "los 40",
  "eurovisión",
  "eurovision",
  "benidorm fest",
  "operación triunfo",
  "operacion triunfo",
  "ot ",
  "tiktok",
  "influencer",
  "reality",
  "telecinco",
  "gran hermano",
  "famosos",
  "alfombra roja",
  "grammy latino"
];

const POSITIVE_WORDS = {
  sitios: [
    "ruta",
    "rutas",
    "escapada",
    "mirador",
    "senderismo",
    "naturaleza",
    "pueblo",
    "pueblos",
    "visitar",
    "patrimonio",
    "parque",
    "montaña",
    "montana",
    "cascada",
    "castillo",
    "monasterio",
    "turismo"
  ],
  comer: [
    "restaurante",
    "bar",
    "tapas",
    "comer",
    "gastronomía",
    "gastronomia",
    "cocina",
    "menú",
    "menu",
    "producto local",
    "terraza",
    "cafetería",
    "cafeteria",
    "chef",
    "asador",
    "bodega",
    "brasa"
  ],
  rural: [
    "agricultura",
    "ganadería",
    "ganaderia",
    "granja",
    "granjas",
    "huerto",
    "cultivo",
    "cultivos",
    "regadío",
    "regadio",
    "tractor",
    "aceite",
    "queso",
    "huevos",
    "producto local",
    "cooperativa",
    "venta directa",
    "agroturismo",
    "turismo rural",
    "obrador",
    "pueblo",
    "campo",
    "ecológico",
    "ecologico"
  ],
  negocios: [
    "negocio",
    "negocios",
    "emprendedor",
    "emprendedores",
    "emprendimiento",
    "pequeño comercio",
    "pequeno comercio",
    "tienda",
    "local",
    "barbería",
    "barberia",
    "peluquería",
    "peluqueria",
    "marketing",
    "digital",
    "redes sociales",
    "fidelización",
    "fidelizacion",
    "comunidad",
    "marca"
  ],
  estilo: [
    "peluquería",
    "peluqueria",
    "barbería",
    "barberia",
    "rastas",
    "dreadlocks",
    "cabello",
    "pelo",
    "barba",
    "corte",
    "fade",
    "peinado",
    "tendencia",
    "cuidado",
    "hidratación",
    "hidratacion",
    "mantenimiento"
  ],
  musica: [
    "morodo",
    "pure negga",
    "fyahbwoy",
    "little pepe",
    "rapsusklei",
    "kase.o",
    "kase o",
    "violadores del verso",
    "doble v",
    "nach",
    "sfdk",
    "toteking",
    "sho-hai",
    "shohai",
    "sharif",
    "xhelazz",
    "juaninacka",
    "falsalarma",
    "reggae",
    "rap",
    "hip hop",
    "underground",
    "nuevo tema",
    "nuevo single",
    "nueva canción",
    "nueva cancion",
    "videoclip",
    "videoclip oficial",
    "álbum",
    "album",
    "disco",
    "ep",
    "lanzamiento",
    "gira",
    "concierto",
    "directo",
    "youtube",
    "canal oficial",
    "entrevista"
  ],
  curiosidades: [
    "curiosidad",
    "curiosidades",
    "ciencia",
    "historia",
    "naturaleza",
    "animales",
    "patrimonio",
    "descubren",
    "descubrimiento",
    "sorprendente",
    "origen",
    "por qué",
    "por que"
  ]
};

function fallbackNews() {
  const now = new Date().toISOString();

  return [
    {
      id: "fallback-musica-1",
      title: "Reggae y rap clásico: novedades sin ruido comercial",
      summary:
        "Sección para seguir lanzamientos, videoclips y conciertos de artistas como Morodo, Pure Negga, Fyahbwoy, Rapsusklei, Kase.O, Nach, SFDK o Sho-Hai.",
      url:
        "https://www.youtube.com/results?search_query=Morodo+Pure+Negga+Fyahbwoy+Rapsusklei+Kase.O+nuevo+tema+oficial",
      image: "",
      source: "Selección música",
      category: "musica",
      categoryLabel: "Reggae & rap clásico",
      date: now
    },
    {
      id: "fallback-sitios-1",
      title: "Sitios con encanto para guardar y visitar sin complicarse",
      summary:
        "Miradores, pueblos bonitos, rutas cortas y paradas con buen ambiente. Una sección pensada para encontrar planes reales, no solo titulares.",
      url:
        "https://www.google.com/search?q=sitios+con+encanto+Arag%C3%B3n+Navarra+rutas+pueblos+bonitos",
      image: "",
      source: "Selección",
      category: "sitios",
      categoryLabel: "Sitios con encanto",
      date: now
    },
    {
      id: "fallback-comer-1",
      title: "Bares y restaurantes con producto local que merecen ficha",
      summary:
        "Ideas para descubrir sitios donde comer bien: tapas, menús, cocina de cercanía, terrazas y lugares con historia.",
      url:
        "https://www.google.com/search?q=bares+restaurantes+producto+local+Zaragoza+Navarra+Arag%C3%B3n",
      image: "",
      source: "Selección",
      category: "comer",
      categoryLabel: "Comer bien",
      date: now
    },
    {
      id: "fallback-rural-1",
      title: "Pequeñas granjas, huertos y negocios de pueblo con futuro",
      summary:
        "Campo, agricultura, venta directa, obradores y proyectos rurales contados desde una mirada útil e inspiradora.",
      url:
        "https://www.google.com/search?q=agricultura+granjas+negocios+rurales+Arag%C3%B3n+Navarra",
      image: "",
      source: "Selección rural",
      category: "rural",
      categoryLabel: "Vida rural",
      date: now
    },
    {
      id: "fallback-estilo-1",
      title: "Rastas, barba y corte: mantenimiento que se nota",
      summary:
        "Consejos e ideas de estilo para que el pelo, la barba o las rastas no dependan solo del primer día de peluquería.",
      url: "https://www.google.com/search?q=cuidados+rastas+barba+corte+pelo",
      image: "",
      source: "Selección estilo",
      category: "estilo",
      categoryLabel: "Pelo & rastas",
      date: now
    },
    {
      id: "fallback-negocios-1",
      title: "Ideas de negocio local que pueden inspirar a pequeños comercios",
      summary:
        "Marketing sencillo, reservas, comunidad y fidelización para que un negocio pequeño parezca más vivo y cercano.",
      url:
        "https://www.google.com/search?q=ideas+negocio+local+peque%C3%B1o+comercio+marketing",
      image: "",
      source: "Selección negocios",
      category: "negocios",
      categoryLabel: "Negocios locales",
      date: now
    }
  ];
}

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
    .replace(/&hellip;/g, "...")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
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

function todaySeed(extra = "") {
  const d = new Date();
  const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}-${extra}`;

  let hash = 2166136261;

  for (let i = 0; i < key.length; i += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  }

  return hash >>> 0;
}

function seededNoise(value, seed) {
  const str = `${seed}-${value}`;
  let hash = 0;

  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }

  return (hash % 1000) / 1000;
}

function safeIsoDate(value) {
  const d = value ? new Date(value) : new Date();

  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString();
  }

  return d.toISOString();
}

function getTagValue(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = String(xml).match(regex);

  return cleanText(match?.[1] || "");
}

function getMediaImage(xml) {
  const source = String(xml || "");

  const enclosure = source.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosure?.[1]) return enclosure[1];

  const mediaContent = source.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaContent?.[1]) return mediaContent[1];

  const mediaThumbnail = source.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (mediaThumbnail?.[1]) return mediaThumbnail[1];

  const img = source.match(/<img[^>]+src=["']([^"']+)["']/i);
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

  if (category === "musica") {
    const title = hay;
    if (title.includes("nuevo tema") || title.includes("nuevo single") || title.includes("videoclip")) score += 6;
    if (title.includes("youtube") || title.includes("oficial")) score += 4;
    if (title.includes("concierto") || title.includes("gira")) score += 2;
  }

  if (item.image) score += 1;
  if (item.pubDate) score += 1;

  return score;
}

function smartSummary(item, category) {
  const original = cleanText(item.description || "");
  const base = original && original.length > 45 ? original : "";

  const templates = {
    sitios:
      "Idea para guardar: puede servir para una escapada corta, una tarde distinta o descubrir un sitio bonito cerca.",
    comer:
      "Recomendación gastronómica para fichar bares, restaurantes, producto local o sitios donde parar a comer bien.",
    rural:
      "Pieza sobre campo, agricultura, pequeñas granjas, producto local o negocio rural que puede dar ideas útiles y cercanas.",
    negocios:
      "Contenido útil para pequeños negocios: inspiración, marketing, comercio local, comunidad y formas sencillas de vender mejor.",
    estilo:
      "Contenido de estilo, pelo, barbería, rastas o cuidado personal que puede encajar con la comunidad de la app.",
    musica:
      "Novedad musical seleccionada para la comunidad: reggae, rap clásico, hip hop underground, videoclips, directos o lanzamientos reales.",
    curiosidades:
      "Curiosidad para leer rápido y aprender algo distinto sin entrar en ruido político ni titulares densos."
  };

  const chosen = base || templates[category] || "Contenido seleccionado para leer rápido y descubrir algo útil.";

  return chosen.length > 240 ? `${chosen.slice(0, 237).trim()}...` : chosen;
}

function youtubeSearchUrl(title) {
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${title} oficial`);
}

function normalizeItem(item, feed) {
  const rawKey = item.guid || item.link || `${feed.category}-${feed.source}-${item.title}`;
  const cleanTitle = cleanText(item.title || "Contenido destacado");

  return {
    id: `${feed.category}-${makeId(rawKey)}`,
    title: cleanTitle,
    summary: smartSummary(item, feed.category),
    url: item.link || "",
    youtubeUrl: feed.category === "musica" ? youtubeSearchUrl(cleanTitle) : "",
    image: item.image || "",
    source: feed.source,
    category: feed.category,
    categoryLabel: CATEGORY_LABELS[feed.category] || feed.source,
    date: safeIsoDate(item.pubDate),
    score: scoreItem(item, feed.category)
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
        "User-Agent": "RastaCutsActualidad/5.0"
      }
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const items = parseRssItems(xml);

    return items
      .slice(0, 18)
      .filter((item) => item.title && item.link)
      .filter((item) => !hasNegativeNoise(item))
      .map((item) => normalizeItem(item, feed))
      .filter((item) => {
        if (item.score > 0) return true;
        return ["comer", "estilo", "sitios", "rural", "negocios", "musica"].includes(feed.category);
      });
  } catch (error) {
    return [];
  }
}

export default async function handler(req, res) {
  try {
    const category = String(req?.query?.category || "todo").toLowerCase();
    const day = String(req?.query?.day || new Date().toISOString().split("T")[0]);
    const slot = String(req?.query?.slot || "default");
    const refreshSeed = String(req?.query?.seed || "0");
    const limitRaw = Number(req?.query?.limit || 28);
    const limit = Number.isFinite(limitRaw) ? Math.max(5, Math.min(40, limitRaw)) : 28;

    const seed = todaySeed(`${category}-${day}-${slot}-${refreshSeed}`);

    const selectedFeeds =
      category === "todo" ? FEEDS : FEEDS.filter((feed) => feed.category === category);

    const feedsToUse = selectedFeeds.length ? selectedFeeds : FEEDS;

    const chunks = await Promise.all(feedsToUse.map((feed) => loadFeed(feed)));

    const news = removeDuplicates(chunks.flat())
      .sort((a, b) => {
        const scoreDiff = (b.score || 0) - (a.score || 0);

        if (Math.abs(scoreDiff) >= 4) {
          return scoreDiff;
        }

        const noiseA = seededNoise(a.id || a.url || a.title, seed);
        const noiseB = seededNoise(b.id || b.url || b.title, seed);
        const dateDiff = new Date(b.date) - new Date(a.date);

        return dateDiff / 86400000 + (noiseB - noiseA) * 3;
      })
      .slice(0, limit)
      .map(({ score, ...item }) => item);

    const fallback = fallbackNews().filter((item) =>
      category === "todo" ? true : item.category === category
    );

    res.setHeader("Cache-Control", "max-age=0, s-maxage=300, stale-while-revalidate=1800");

    res.status(200).json({
      ok: true,
      mode: "daily-rotated-curated-music-no-deps",
      day,
      slot,
      refreshSeed,
      count: news.length,
      categories: CATEGORY_LABELS,
      news: news.length ? news : (fallback.length ? fallback : fallbackNews())
    });
  } catch (error) {
    res.status(200).json({
      ok: false,
      mode: "fallback",
      error: "No se pudieron cargar las fuentes curadas.",
      categories: CATEGORY_LABELS,
      news: fallbackNews()
    });
  }
}
