/*
  eslint-disable
    global-require,
    import/no-dynamic-require,
    import/no-extraneous-dependencies
*/

const fs = require('fs');

const MFS = require('memory-fs');
const webpack = require('webpack');
const chokidar = require('chokidar');
const webpackHotMiddleware = require('webpack-hot-middleware');
const webpackDevMiddleware = require('webpack-dev-middleware');

/* eslint-disable no-console */
const log = (...args) => console.log('[HMR]', ...args);
const warn = (...args) => console.warn('[HMR]', ...args);
const error = (...args) => console.error('[HMR]', ...args);
/* eslint-enable no-console */

/**
 * Add HMR support to an express server
 *
 * @param   {[type]}   opts Options object
 * @param   {[type]}   opts.app                  Express server instance
 * @param   {[type]}   opts.clientConfigPath     Webpack client config path, relative to this file
 * @param   {[type]}   opts.serverConfigPath     Webpack server config path, relative to this file
 * @param   {[type]}   opts.templatePath         Server index.html template absolute path
 * @param   {[type]}   opts.serverCreateAppPath  Generated server code path, relative to this file
 * @param   {Function} cb                        Callback function accepting updated files when HMR
 *                                               triggers.  Signature is:
 *                                                 (clientManifest, template, serverCreateApp)
 * @returns {Promise}  Promise to be resolved once both webpack builds finish and the app is
 *                     ready to receive requests
 */
module.exports = function setupDevServer(opts, cb) {
    const { app, clientConfigPath, serverConfigPath, templatePath, serverCreateAppPath } = opts;

    // In-memory file system to build webpack assets to
    const mfs = new MFS();

    let clientManifest;
    let template;
    let serverCreateApp;
    let ready;

    const clientConfig = require(clientConfigPath);
    const serverConfig = require(serverConfigPath);

    const readyPromise = new Promise((r) => { ready = r; });
    const update = () => {
        // Don't resolve until both are ready the first time
        if (serverCreateApp && clientManifest) {
            log('Pushing updated manifest/template/server module to node server');
            cb(serverCreateApp, clientManifest, template);
            ready();
        }
    };

    // read template from disk and watch
    template = fs.readFileSync(templatePath, 'utf-8');
    chokidar.watch(templatePath).on('change', () => {
        log('HTML template changed');
        template = fs.readFileSync(templatePath, 'utf-8').toString();
        update();
    });

    // modify client config to work with hot middleware
    clientConfig.entry.app = [
        'webpack-hot-middleware/client',
        clientConfig.entry.app,
    ];
    clientConfig.output.filename = '[name].js';
    clientConfig.plugins.push(
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin(),
    );

    // dev middleware
    log('Starting client webpack build');
    const clientCompiler = webpack(clientConfig);
    const devMiddleware = webpackDevMiddleware(clientCompiler, { outputFileSystem: mfs });
    app.use(devMiddleware);
    clientCompiler.hooks.done.tap('done', (stats) => {
        log('Completed client webpack build');
        const json = stats.toJson();
        json.errors.forEach(err => error(err));
        json.warnings.forEach(err => warn(err));
        if (json.errors.length) {
            return;
        }
        clientManifest = JSON.parse(mfs.readFileSync(
            `${__dirname}/../dist/client/vue-ssr-client-manifest.json`,
            'utf-8',
        ));
        update();
    });

    // hot middleware
    app.use(webpackHotMiddleware(clientCompiler, { heartbeat: 5000 }));

    // watch and update server renderer
    log('Starting server webpack build');
    const serverCompiler = webpack(serverConfig);
    serverCompiler.watch({}, (err, stats) => {
        log('Completed server webpack build');
        if (err) {
            throw err;
        }
        const json = stats.toJson();
        if (json.errors.length) {
            return;
        }

        // Remove the current version of createApp() and reload from disk.  In prior
        // versions of vue-ssr-build we did this using the in-memory file system since
        // bundle-runner allowed us to re-evaluate modules at runtime.  Since we've
        // gotten rid of vue-bundle-renderer the best way to re-load this "new" server
        // module is to clear the require cache and re-require from disk.
        //
        // See: https://remarkablemark.org/blog/2019/09/02/nodejs-reload-module/
        delete require.cache[require.resolve(serverCreateAppPath)];
        serverCreateApp = require(serverCreateAppPath).default;

        update();
    });

    return readyPromise;
};
