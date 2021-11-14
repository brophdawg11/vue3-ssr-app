const fs = require('fs');
const path = require('path');

const express = require('express');
const { createSSRApp } = require('vue');
const { renderToString } = require('@vue/server-renderer');

const manifest = require('../dist/ssr-manifest.json')
const createApp = require(`../dist/${manifest['main.js']}`).default;

const server = express();
const template = fs.readFileSync(path.join(__dirname, './index.html')).toString();

server.use('/dist', express.static(path.join(__dirname, '../dist')));

server.get('*', async (req, res) => {
    const context = {
        url: req.url,
        req,
        res,
    };
    const { app } = await createApp(context);
    const appHtml = await renderToString(app);
    const ssrHtml = template.replace('<!-- vue-ssr-outlet -->', appHtml);
    res.setHeader('Content-Type', 'text/html');
    res.send(ssrHtml);
});

server.listen(8080, () => {
    console.info('Server listening at http://localhost:8080');
});
