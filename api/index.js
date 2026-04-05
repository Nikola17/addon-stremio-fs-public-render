const { getRouter } = require('stremio-addon-sdk');
const { getAddonInterface } = require('../addon');
const path = require('path');
const fs = require('fs');

module.exports = (req, res) => {
    const parts = req.url.split('/').filter(Boolean);

    // Servir la page de configuration si demandé ou à la racine
    if (req.url === '/' || req.url === '/configure') {
        res.setHeader('Content-Type', 'text/html');
        return res.end(fs.readFileSync(path.join(__dirname, '../public/configure.html')));
    }

    // Gérer l'addon avec ou sans config
    let configStr = null;
    if (parts.length >= 1 && !['manifest.json', 'catalog', 'meta'].includes(parts[0])) {
        configStr = parts[0];
        // Retirer le hash du chemin pour que le router de l'SDK puisse matcher les routes (/manifest.json, etc.)
        req.url = req.url.replace('/' + configStr, '');
        if (req.url === '') req.url = '/';
    }

    // Cache Vercel: 2h en cache (s-maxage), stale-while-revalidate 1h
    if (req.url.includes('/catalog/') || req.url.includes('/meta/')) {
        res.setHeader('Cache-Control', 'max-age=3600, s-maxage=7200, stale-while-revalidate=3600, public');
    }

    const addonInterface = getAddonInterface(configStr);
    const router = getRouter(addonInterface);

    router(req, res, () => {
        res.status(404).end();
    });
};
