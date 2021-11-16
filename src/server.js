const fs = require('fs');

const express = require('express');
const { renderToString } = require('@vue/server-renderer');

const { default: createApp } = require('../dist/server/app');
const clientManifest = require('../dist/client/vue-ssr-client-manifest.json');

const { publicPath } = clientManifest;
const server = express();
const template = fs.readFileSync(`${__dirname}/index.html`).toString();

server.use(clientManifest.publicPath, express.static(`${__dirname}/../dist/client`));

const renderAttrs = attrs => Object.entries(attrs)
    .map(([k, v]) => `${k}${v != null ? `="${v}"` : ''}`).join(' ');
const renderEl = (tag, attrs) => `<${tag} ${renderAttrs(attrs)}></${tag}>`;

server.get(/^[a-z0-9-_/]*$/i, async (req, res) => {
    const context = {
        url: req.url,
        req,
        res,
        // Vue3 does not provide bundle renderer functionality out of the box so
        // we handle locally: https://github.com/vuejs/vue-next/issues/1327
        _registeredComponents: new Set(),
    };

    // Create/Render app
    const { app } = await createApp(context);
    const appHtml = await renderToString(app, context);

    // Determine <link>/<script> tags to include for this route
    // eslint-disable-next-line no-underscore-dangle
    const activeAssets = [...context._registeredComponents]
        .flatMap(id => clientManifest.modules[id] || [])
        .map(idx => clientManifest.all[idx])
        .filter(s => s);

    const activeScripts = activeAssets.filter(path => path.endsWith('.js'));
    const activeStylesheets = activeAssets.filter(path => path.endsWith('.css'));

    const stylesheetsHtml = activeStylesheets
        .map(path => renderEl('link', {
            rel: 'stylesheet',
            href: `${publicPath}${path}`,
        }))
        .join('');

    const preloadHtml = activeScripts
        .map(path => renderEl('link', {
            rel: 'preload',
            as: 'script',
            href: `${publicPath}${path}`,
        }))
        .join('');

    const scriptsHtml = activeScripts
        .map(path => renderEl('script', {
            src: `${publicPath}${path}`,
            defer: null,
        }))
        .join('');

    // Perform template replacement
    const ssrHtml = template
        .replace('<!-- vue-ssr-stylesheets -->', stylesheetsHtml)
        .replace('<!-- vue-ssr-preload -->', preloadHtml)
        .replace('<!-- vue-ssr-contents -->', appHtml)
        .replace(
            '<!-- vue-ssr-initial-state -->',
            `<script>window.initialState=JSON.parse(${context.initialState});</script>`,
        )
        .replace('<!-- vue-ssr-scripts -->', scriptsHtml);

    res.setHeader('Content-Type', 'text/html');
    res.send(ssrHtml);
});

server.listen(8080, () => {
    // eslint-disable-next-line no-console
    console.info('Server listening at http://localhost:8080');
});
