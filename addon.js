const { addonBuilder, serveHTTP, getRouter } = require('stremio-addon-sdk');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

// ============================================================================
// CONFIGURATION & CATALOGS
// ============================================================================

const CACHE_TTL = 60 * 60 * 1000; // 1 heure
const cache = new Map();
const metaCache = new Map();

const ALL_CATALOGS = {
    'derniers-films': { name: 'FS - Derniers Films', type: 'movie', baseUrl: 'https://french-stream.pink/films/', pageUrl: 'https://french-stream.pink/films/page/{page}/' },
    'films-action': { name: 'FS - Films Action', type: 'movie', baseUrl: 'https://french-stream.pink/films/actions/', pageUrl: 'https://french-stream.pink/films/actions/page/{page}/' },
    'dernieres-series': { name: 'FS - Dernières Séries', type: 'series', baseUrl: 'https://french-stream.pink/s-tv/', pageUrl: 'https://french-stream.pink/s-tv/page/{page}/' },
    'series-netflix': { name: 'FS - Séries Netflix', type: 'series', baseUrl: 'https://french-stream.pink/s-tv/netflix-series-/', pageUrl: 'https://french-stream.pink/s-tv/netflix-series-/page/{page}/' },
    'series-appletv': { name: 'FS - Séries Apple TV+', type: 'series', baseUrl: 'https://french-stream.pink/s-tv/series-apple-tv/', pageUrl: 'https://french-stream.pink/s-tv/series-apple-tv/page/{page}/' },
    'series-prime': { name: 'FS - Séries Prime Video', type: 'series', baseUrl: 'https://french-stream.pink/s-tv/serie-amazon-prime-videos/', pageUrl: 'https://french-stream.pink/s-tv/serie-amazon-prime-videos/page/{page}/' },
    'series-disneyplus': { name: 'FS - Séries Disney+', type: 'series', baseUrl: 'https://french-stream.pink/s-tv/series-disney-plus/', pageUrl: 'https://french-stream.pink/s-tv/series-disney-plus/page/{page}/' },
    'documentaires': { name: 'FS - Documentaires', type: 'movie', baseUrl: 'https://french-stream.pink/films/documentaires/', pageUrl: 'https://french-stream.pink/films/documentaires/page/{page}/' },
    'horreur': { name: 'FS - Horreur', type: 'movie', baseUrl: 'https://french-stream.pink/films/epouvante-horreurs/', pageUrl: 'https://french-stream.pink/films/epouvante-horreurs/page/{page}/' },
    'animations': { name: 'FS - Animations', type: 'movie', baseUrl: 'https://french-stream.pink/films/animations/', pageUrl: 'https://french-stream.pink/films/animations/page/{page}/' },
    'aventures': { name: 'FS - Aventures', type: 'movie', baseUrl: 'https://french-stream.pink/films/aventures/', pageUrl: 'https://french-stream.pink/films/aventures/page/{page}/' },
    'art-martiaux': { name: 'FS - Arts Martiaux', type: 'movie', baseUrl: 'https://french-stream.pink/art-martiaux/', pageUrl: 'https://french-stream.pink/art-martiaux/page/{page}/' },
    'biopics': { name: 'FS - Biopics', type: 'movie', baseUrl: 'https://french-stream.pink/films/biopics/', pageUrl: 'https://french-stream.pink/films/biopics/page/{page}/' },
    'comedies': { name: 'FS - Comédies', type: 'movie', baseUrl: 'https://french-stream.pink/films/comedies/', pageUrl: 'https://french-stream.pink/films/comedies/page/{page}/' },
    'espionnages': { name: 'FS - Espionnages', type: 'movie', baseUrl: 'https://french-stream.pink/films/espionnages/', pageUrl: 'https://french-stream.pink/films/espionnages/page/{page}/' },
    'familles': { name: 'FS - Familles', type: 'movie', baseUrl: 'https://french-stream.pink/films/familles/', pageUrl: 'https://french-stream.pink/films/familles/page/{page}/' },
    'fantastiques': { name: 'FS - Fantastiques', type: 'movie', baseUrl: 'https://french-stream.pink/films/fantastiques/', pageUrl: 'https://french-stream.pink/films/fantastiques/page/{page}/' },
    'policiers': { name: 'FS - Policiers', type: 'movie', baseUrl: 'https://french-stream.pink/films/policiers/', pageUrl: 'https://french-stream.pink/films/policiers/page/{page}/' },
    'thrillers': { name: 'FS - Thrillers', type: 'movie', baseUrl: 'https://french-stream.pink/films/thrillers/', pageUrl: 'https://french-stream.pink/films/thrillers/page/{page}/' },
    'westerns': { name: 'FS - Westerns', type: 'movie', baseUrl: 'https://french-stream.pink/films/westerns/', pageUrl: 'https://french-stream.pink/films/westerns/page/{page}/' },
    'drames': { name: 'FS - Drames', type: 'movie', baseUrl: 'https://french-stream.pink/films/drames/', pageUrl: 'https://french-stream.pink/films/drames/page/{page}/' },
    'historiques': { name: 'FS - Historiques', type: 'movie', baseUrl: 'https://french-stream.pink/films/historiques/', pageUrl: 'https://french-stream.pink/films/historiques/page/{page}/' },
    'guerres': { name: 'FS - Guerres', type: 'movie', baseUrl: 'https://french-stream.pink/films/guerres/', pageUrl: 'https://french-stream.pink/films/guerres/page/{page}/' },
    'romances': { name: 'FS - Romances', type: 'movie', baseUrl: 'https://french-stream.pink/films/romances/', pageUrl: 'https://french-stream.pink/films/romances/page/{page}/' },
    'science-fictions': { name: 'FS - Science Fictions', type: 'movie', baseUrl: 'https://french-stream.pink/films/science-fictions/', pageUrl: 'https://french-stream.pink/films/science-fictions/page/{page}/' },
    'spectacle': { name: 'FS - Spectacle', type: 'movie', baseUrl: 'https://french-stream.pink/xfsearch/genre-1/spectacle/', pageUrl: 'https://french-stream.pink/xfsearch/genre-1/spectacle/page/{page}/' }
};

// ============================================================================
// UTILS
// ============================================================================

function parseConfig(configStr) {
    if (!configStr) return { tmdbKey: null, rpdbKey: 't0-free-rpdb', catalogs: Object.keys(ALL_CATALOGS), vfOnly: false };
    try {
        const decoded = Buffer.from(configStr, 'base64').toString();
        const config = JSON.parse(decoded);
        return {
            tmdbKey: config.t || null,
            rpdbKey: config.r ? 't0-free-rpdb' : null,
            catalogs: config.c || Object.keys(ALL_CATALOGS),
            vfOnly: config.v || false
        };
    } catch (e) {
        return { tmdbKey: null, rpdbKey: 't0-free-rpdb', catalogs: Object.keys(ALL_CATALOGS), vfOnly: false };
    }
}

function cleanSeriesTitle(title) {
    return title
        .replace(/[\s\-–]+(Saison|S|Season)\s*\d+/gi, '')
        .replace(/\s+\d+$/, '')
        .trim();
}

// ============================================================================
// TMDB & SCRAPER
// ============================================================================

async function searchTMDB(title, type, tmdbKey) {
    if (!tmdbKey) return null;
    try {
        let cleanTitle = title.replace(/\(?\d{4}\)?/g, '').replace(/[^\w\s\u00C0-\u017F]/g, ' ').replace(/\s+/g, ' ').trim();
        const mediaType = type === 'movie' ? 'movie' : 'tv';
        const searchUrl = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${tmdbKey}&query=${encodeURIComponent(cleanTitle)}&language=fr-FR`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        if (searchData.results && searchData.results.length > 0) {
            let result = searchData.results[0];
            for (const r of searchData.results.slice(0, 5)) {
                if ((r.title || r.name || '').toLowerCase() === cleanTitle.toLowerCase()) { result = r; break; }
            }
            const detailsResponse = await fetch(`https://api.themoviedb.org/3/${mediaType}/${result.id}?api_key=${tmdbKey}&language=fr-FR&append_to_response=external_ids`);
            const details = await detailsResponse.json();
            return {
                tmdbId: result.id,
                imdbId: details.external_ids?.imdb_id || details.imdb_id || null,
                poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
                backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : null,
                year: details.release_date?.substring(0, 4) || details.first_air_date?.substring(0, 4),
                title: details.title || details.name,
                description: details.overview,
                rating: details.vote_average,
                genres: details.genres?.map(g => g.name) || [],
                runtime: details.runtime
            };
        }
    } catch (e) { console.error('TMDB Error:', e.message); }
    return null;
}

async function fetchPage(url) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        return await response.text();
    } catch (e) { return null; }
}

async function scrapeItems(html, type) {
    const $ = cheerio.load(html);
    const items = [];
    const $items = $('.short-in, .movie-item, .short, article.short, .th-item');
    $items.each((i, el) => {
        const $link = $(el).find('a[href]').first();
        let title = $(el).find('.short-title, .th-title, h3, h4, .title').text().trim() || $link.attr('title') || '';
        let poster = $(el).find('img').first().attr('src') || '';
        if (poster && !poster.startsWith('http')) poster = 'https://french-stream.pink' + poster;

        // Détecter les tags de langue (VF, VOSTFR, FRENCH, TRUEFRENCH)
        const fullText = $(el).text().toUpperCase();
        const hasVF = fullText.includes('VF') || fullText.includes('FRENCH') || fullText.includes('TRUEFRENCH');
        const hasVOSTFR = fullText.includes('VOSTFR');
        const isVostfrOnly = hasVOSTFR && !hasVF;

        if (title && $link.attr('href')) items.push({ title, poster, href: $link.attr('href'), type, isVostfrOnly });
    });
    return items;
}

async function getCatalogItems(catalogId, config) {
    const cacheKey = `${catalogId}_${JSON.stringify(config)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const catalog = ALL_CATALOGS[catalogId];
    if (!catalog) return [];

    const pagePromises = Array.from({ length: 3 }, (_, i) => {
        const url = i === 0 ? catalog.baseUrl : catalog.pageUrl.replace('{page}', i + 1);
        return fetchPage(url).then(html => html ? scrapeItems(html, catalog.type) : []);
    });

    const pages = await Promise.all(pagePromises);
    const seen = new Set();
    const allItems = [];
    pages.flat().forEach(item => {
        // Filtrage VF si l'option est activée
        if (config.vfOnly && item.isVostfrOnly) return;

        const sTitle = catalog.type === 'series' ? cleanSeriesTitle(item.title) : item.title;
        if (!seen.has(sTitle.toLowerCase())) {
            seen.add(sTitle.toLowerCase());
            allItems.push({ ...item, searchTitle: sTitle });
        }
    });

    const enriched = [];
    const BATCH_SIZE = 10;
    for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
        const batch = allItems.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async item => {
            const tmdb = await searchTMDB(item.searchTitle, item.type, config.tmdbKey);
            let id = `fs:${Buffer.from(item.searchTitle).toString('base64').substring(0, 20)}`;
            let poster = item.poster;
            if (tmdb) {
                id = tmdb.imdbId || `tmdb:${tmdb.tmdbId}`;
                poster = (config.rpdbKey && tmdb.imdbId) ? `https://api.ratingposterdb.com/${config.rpdbKey}/imdb/poster-default/${tmdb.imdbId}.jpg` : (tmdb.poster || poster);
                metaCache.set(`${item.type}:${id}`, {
                    id, type: item.type, name: tmdb.title || item.searchTitle || item.title, poster, background: tmdb.backdrop,
                    description: tmdb.description, releaseInfo: tmdb.year, imdbRating: tmdb.rating,
                    genres: tmdb.genres, runtime: tmdb.runtime ? `${tmdb.runtime} min` : undefined,
                    behaviorHints: item.type === 'movie' ? { defaultVideoId: id, hasScheduledVideos: false } : undefined
                });
            }
            return { id, type: item.type, name: item.searchTitle || item.title, poster, posterShape: 'poster' };
        }));
        enriched.push(...batchResults);
    }
    cache.set(cacheKey, enriched);
    return enriched;
}

// ============================================================================
// SEARCH FEATURE (INNOVATIVE)
// ============================================================================

async function searchFrenchStream(query, type) {
    const searchUrl = `https://french-stream.pink/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}`;
    const html = await fetchPage(searchUrl);
    if (!html) return [];
    return scrapeItems(html, type);
}

// ============================================================================
// ADDON BUILDER
// ============================================================================

function createManifest(config) {
    const selected = config.catalogs.map(id => ({
        type: ALL_CATALOGS[id].type,
        id: `fs-${id}`,
        name: ALL_CATALOGS[id].name
    }));

    return {
        id: 'community.french-stream-public',
        version: '1.2.0',
        name: 'French Stream (Public)',
        description: 'Version publique configurable avec recherche et nouvelles catégories.',
        logo: 'https://french-stream.pink/templates/flavor/dleflavour/assets/images/x325_logo.png.pagespeed.ic.hpZlJOA7lE.webp',
        resources: ['catalog', 'meta'],
        types: ['movie', 'series'],
        idPrefixes: ['tt', 'tmdb:', 'fs:'],
        catalogs: [
            ...selected,
            { type: 'movie', id: 'fs-search', name: 'Recherche French Stream', extra: [{ name: 'search', isRequired: true }] }
        ],
        behaviorHints: { configurable: true, configurationRequired: false }
    };
}

const getAddonInterface = (configStr) => {
    const config = parseConfig(configStr);
    const builder = new addonBuilder(createManifest(config));

    builder.defineCatalogHandler(async ({ type, id, extra }) => {
        if (id === 'fs-search' && extra.search) {
            const results = await searchFrenchStream(extra.search, type);
            // Enrichissement minimal pour la recherche (ou complet si nécessaire)
            return {
                metas: results.map(r => ({
                    id: `fs:${Buffer.from(r.title).toString('base64').substring(0, 20)}`,
                    type: r.type, name: r.title, poster: r.poster, posterShape: 'poster'
                }))
            };
        }
        const catalogId = id.replace('fs-', '');
        const items = await getCatalogItems(catalogId, config);
        return { metas: items };
    });

    builder.defineMetaHandler(async ({ type, id }) => {
        if (id.startsWith('tt') || id.startsWith('tmdb:')) return { meta: null };
        return { meta: metaCache.get(`${type}:${id}`) || null };
    });

    return builder.getInterface();
};

module.exports = { getAddonInterface, ALL_CATALOGS };
