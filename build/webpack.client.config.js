const webpack = require('webpack');
const { merge } = require('webpack-merge');
const { VueSSRClientPlugin } = require('./vue-ssr-client-plugin');
const { baseConfig } = require('./webpack.base.config');

module.exports = merge(baseConfig, {
    entry: {
        app: './src/entry-client.js',
    },
    output: {
        path: `${__dirname}/../dist/client`,
    },
    plugins: [
        new webpack.DefinePlugin({ 'process.env.VUE_ENV': '"client"' }),
        new VueSSRClientPlugin(),
    ],
});
