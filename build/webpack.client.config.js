const webpack = require('webpack');
const { merge } = require('webpack-merge');
const { baseConfig } = require('./webpack.base.config');

module.exports = merge(baseConfig, {
    entry: {
        app: './src/entry-client.js',
    },
    plugins: [
        new webpack.DefinePlugin({ 'process.env.VUE_ENV': '"client"' }),
    ],
});
