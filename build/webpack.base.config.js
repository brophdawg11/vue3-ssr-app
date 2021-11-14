const { resolve } = require('path');
const webpack = require('webpack');
const { VueLoaderPlugin } = require('vue-loader');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const baseConfig = {
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? 'source-map' : 'inline-source-map',
    resolve: {
        extensions: ['.js'],
    },
    output: {
        filename: '[name].js',
        chunkFilename: 'async/[name].js',
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
            },
        ],
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(nodeEnv),
            // See: https://github.com/vuejs/vue-next/tree/master/packages/vue#bundler-build-feature-flags
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false,
        }),
        new VueLoaderPlugin(),
    ],
    stats: {
        // Enhance error logging
        errorDetails: true,
    },
};

module.exports = {
    isProd,
    baseConfig,
};
