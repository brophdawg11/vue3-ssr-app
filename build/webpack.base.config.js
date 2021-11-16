const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { VueLoaderPlugin } = require('vue-loader');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
// TODO
const extractCss = true;

function getCssLoaders(isServer) {
    const cssLoaders = [
        {
            loader: 'css-loader',
            options: {
                // Required to work with css-loader@4
                // https://github.com/vuejs/vue-style-loader/issues/46#issuecomment-670624576
                esModule: false,
                // Number of loaders applied prior to css-loader
                // See https://vue-loader.vuejs.org/guide/pre-processors.html#postcss
                importLoaders: 1,
            },
        },
        {
            loader: 'postcss-loader',
            options: {
                // Passed through to postcss.config.js
                postcssOptions: {
                    minimize: isProd,
                },
            },
        },
    ];

    let loaders;

    if (isServer) {
        if (extractCss) {
            if (!cssLoaders[0].options.modules) {
                cssLoaders[0].options.modules = {};
            }
            cssLoaders[0].options.modules.exportOnlyLocals = true;
            loaders = [...cssLoaders];
        } else {
            loaders = ['vue-style-loader', ...cssLoaders];
        }
    } else if (extractCss) {
        loaders = [MiniCssExtractPlugin.loader, ...cssLoaders];
    } else {
        loaders = ['vue-style-loader', ...cssLoaders];
    }

    return loaders;
}

function getBaseConfig(isServer) {
    return {
        mode: isProd ? 'production' : 'development',
        devtool: isProd ? 'source-map' : 'inline-source-map',
        resolve: {
            extensions: ['.js'],
        },
        output: {
            publicPath: '/dist/',
            filename: '[name].js',
            chunkFilename: 'async/[name].js',
        },
        module: {
            rules: [
                {
                    test: /\.vue$/,
                    loader: 'vue-loader',
                },
                {
                    test: /\.css$/,
                    use: getCssLoaders(isServer),
                },
                {
                    test: /\.scss$/,
                    use: [
                        ...getCssLoaders(isServer),
                        {
                            loader: 'sass-loader',
                            options: {
                                // TODO
                                additionalData: '',
                            },
                        },
                    ],
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
            ...(extractCss ? [
                new MiniCssExtractPlugin({
                    filename: isProd ? 'app.[contenthash].css' : 'app.css',
                    chunkFilename: isProd ? '[name].[contenthash].css' : '[name].css',
                    // TODO
                    // insert: cssInsert,
                }),
            ] : []),
        ],
        stats: {
            // Enhance error logging
            errorDetails: true,
        },
    };
}

module.exports = {
    isProd,
    getBaseConfig,
};
