const { getRouter } = require('stremio-addon-sdk');
const { getAddonInterface } = require('./addon');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 7000;

const server = http.createServer((req, res) => {
    const parts = req.url.split('/').filter(Boolean);

    if (req.url === '/' || req.url === '/configure') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(fs.readFileSync(path.join(__dirname, 'public/configure.html')));
    }

    let configStr = null;
    if (parts.length >= 1 && !['manifest.json', 'catalog', 'meta'].includes(parts[0])) {
        configStr = parts[0];
        req.url = req.url.replace('/' + configStr, '') || '/';
    }

    if (req.url.includes('/catalog/') || req.url.includes('/meta/')) {
        res.setHeader('Cache-Control', 'max-age=3600, s-maxage=7200, stale-while-revalidate=3600, public');
    }

    const addonInterface = getAddonInterface(configStr);
    const router = getRouter(addonInterface);

    router(req, res, () => {
        res.writeHead(404);
        res.end();
    });
});

server.listen(PORT, () => {
    console.log(`Addon French Stream démarré sur le port ${PORT}`);
});
