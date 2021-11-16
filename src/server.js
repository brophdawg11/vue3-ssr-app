const fs = require('fs');

const express = require('express');
const { renderToString } = require('@vue/server-renderer');

const setupDevServer = require('./setup-dev-server');

const createApp = require('../dist/server/app').default;

const publicPath = '/dist/';
const templatePath = `${__dirname}/index.html`;

const server = express();

const isHMR = process.env.IS_HMR === 'true';

let hmr;
let clientManifest;
let template;

const renderAttrs = attrs => Object.entries(attrs)
    .map(([k, v]) => `${k}${v != null ? `="${v}"` : ''}`).join(' ');
const renderEl = (tag, attrs) => `<${tag} ${renderAttrs(attrs)}></${tag}>`;

async function render(localCreateApp, localClientManifest, localTemplate, req, res) {
    const context = {
        url: req.url,
        req,
        res,
        // Vue3 does not provide bundle renderer functionality out of the box so
        // we handle locally: https://github.com/vuejs/vue-next/issues/1327
        _registeredComponents: new Set(),
    };

    // Create/Render app
    const { app } = await localCreateApp(context);
    const appHtml = await renderToString(app, context);

    // Determine <link>/<script> tags to include for this route
    // eslint-disable-next-line no-underscore-dangle
    const activeAssets = [...context._registeredComponents]
        .flatMap(id => localClientManifest.modules[id] || [])
        .map(idx => localClientManifest.all[idx])
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
    const ssrHtml = localTemplate
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
}

if (isHMR) {
    hmr = {};
    const hmrOpts = {
        app: server,
        clientConfigPath: '../build/webpack.client.config',
        serverConfigPath: '../build/webpack.server.config',
        templatePath,
        serverCreateAppPath: '../dist/server/app',
    };
    // Setup HMR, which will internally kick off both client and server builds
    // Once readyPromise resolves, we're good to accept requests.  The callback
    // function here will always update the hmr.* fields to the latest and greatest
    // versions so that when we call rendeR() below we're always using the latest
    hmr.readyPromise = setupDevServer(hmrOpts, (hmrClientManifest, hmrTemplate, hmrCreateApp) => {
        hmr.createApp = hmrCreateApp;
        hmr.clientManifest = hmrClientManifest;
        hmr.template = hmrTemplate;
    });
    server.get(/^[a-z0-9-_/]*$/i, async (req, res, next) => {
        try {
            await hmr.readyPromise;
            await render(hmr.createApp, hmr.clientManifest, hmr.template, req, res);
        } catch (e) {
            next(e);
        }
    });
} else {
    // eslint-disable-next-line global-require
    clientManifest = require('../dist/client/vue-ssr-client-manifest.json');
    template = fs.readFileSync(templatePath).toString();
    // Don't serve static files from dist during HRM, we want them handled by the
    // HMR in-memory FS
    server.use(publicPath, express.static(`${__dirname}/../dist/client`));
    server.get(/^[a-z0-9-_/]*$/i, async (req, res, next) => {
        try {
            await render(createApp, clientManifest, template, req, res);
        } catch (e) {
            next(e);
        }
    });
}

server.listen(8080, () => {
    // eslint-disable-next-line no-console
    console.info('Server listening at http://localhost:8080');
});
