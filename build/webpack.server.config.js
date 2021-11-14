const webpack = require('webpack');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin')
const { merge } = require('webpack-merge');
const nodeExternals = require('webpack-node-externals')
const { baseConfig } = require('./webpack.base.config');

module.exports = merge(baseConfig, {
    entry: './src/entry-server.js',
    output: {
        library: {
            type: 'commonjs2',
        },
    },
    target: 'node',
    externalsPresets: {
        node: true,
    },
    externals: [nodeExternals({ allowlist: /\.(css|vue)$/ })],
    plugins: [
        new webpack.DefinePlugin({ 'process.env.VUE_ENV': '"server"' }),
        new WebpackManifestPlugin({ fileName: 'ssr-manifest.json' }),
    ],
});
