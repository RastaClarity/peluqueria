import Parser from "rss-parser";

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "RastaCutsNewsBot/1.0"
  }
});

const FEEDS = [
  {
    category: "actualidad",
    source: "El País",
    url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada"
  },
  {
    category: "zaragoza",
    source: "Heraldo",
    url: "https://www.heraldo.es/rss"
  },
  {
    category: "videojuegos",
    source: "VidaExtra",
    url: "https://www.vidaextra.com/feedburner.xml"
  },
  {
    category: "tecnologia",
    source: "Xataka",
    url: "https://www.xataka.com/feedburner.xml"
  }
];

function cleanText(text = "") {
  return String(text)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getImage(item) {
  return (
    item.enclosure?.url ||
    item["media:content"]?.url ||
    item["media:thumbnail"]?.url ||
    ""
  );
}

function normalizeItem(item, feed) {
  return {
    id: `${feed.source}-${item.guid || item.link || item.title}`,
    title: cleanText(item.title || "Noticia sin título"),
    summary: cleanText(item.contentSnippet || item.content || item.summary || "").slice(0, 220),
    url: item.link || "",
    image: getImage(item),
    source: feed.source,
    category: feed.category,
    date: item.isoDate || item.pubDate || new Date().toISOString()
  };
}

const FALLBACK_NEWS = [
  {
    id: "fallback-1",
    title: "Rasta Cuts prepara nuevas funciones para su comunidad",
    summary: "Muy pronto habrá más novedades, juegos, retos, premios y contenido para los usuarios.",
    url: "https://www.google.com/search?q=noticias+actualidad",
    image: "",
    source: "Rasta Cuts",
    category: "actualidad",
    date: new Date().toISOString()
  },
  {
    id: "fallback-2",
    title: "Curiosidad: el cabello puede crecer cerca de un centímetro al mes",
    summary: "El crecimiento varía según la persona, la genética, la alimentación y el cuidado del cabello.",
    url: "https://www.google.com/search?q=curiosidades+del+cabello",
    image: "",
    source: "Rasta Cuts",
    category: "curiosidades",
    date: new Date().toISOString()
  }
];

export default async function handler(req, res) {
  try {
    const { category = "todo" } = req.query || {};

    const results = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const data = await parser.parseURL(feed.url);
        return (data.items || []).slice(0, 8).map((item) => normalizeItem(item, feed));
      })
    );

    let news = results
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value)
      .filter((item) => item.title && item.url);

    if (category !== "todo") {
      news = news.filter((item) => item.category === category);
    }

    news = news
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 24);

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    res.status(200).json({
      ok: true,
      count: news.length,
      news: news.length ? news : FALLBACK_NEWS
    });
  } catch (error) {
    res.status(200).json({
      ok: false,
      error: "No se pudieron cargar las noticias RSS.",
      news: FALLBACK_NEWS
    });
  }
}
