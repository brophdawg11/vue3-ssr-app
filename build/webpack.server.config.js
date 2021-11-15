const webpack = require('webpack');
const { merge } = require('webpack-merge');
const nodeExternals = require('webpack-node-externals');

const registerSsrComponentLoader = require.resolve('./register-ssr-component-loader');
const { baseConfig } = require('./webpack.base.config');

module.exports = merge(baseConfig, {
    entry: {
        app: './src/entry-server.js',
    },
    output: {
        path: `${__dirname}/../dist/server`,
        library: {
            type: 'commonjs2',
        },
    },
    target: 'node',
    externalsPresets: {
        node: true,
    },
    externals: [nodeExternals({ allowlist: /\.(css|vue)$/ })],
    module: {
        rules: [
            // This loader registers components for async chunk inference
            {
                test: /\.js$/,
                resourceQuery: /^\?vue/,
                use: registerSsrComponentLoader,
            },
        ],
    },
    plugins: [
        new webpack.DefinePlugin({ 'process.env.VUE_ENV': '"server"' }),
    ],
});
