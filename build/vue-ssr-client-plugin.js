/* eslint-disable */

'use strict';

// Client webpack plugin to generate the client-manifest used to add the proper
// <script> tags at to SSR HTML
//
// See:
//   https://stackoverflow.com/a/64631510/3524793
//   https://github.com/raukaute/vue-hackernews-3.0

Object.defineProperty(exports, '__esModule', { value: true });
const { Compilation } = require('webpack');
const hash = require('hash-sum');

const isJS = (file) => /\.js(\?[^.]+)?$/.test(file);
const isCSS = (file) => /\.css(\?[^.]+)?$/.test(file);

class VueSSRClientPlugin {
    constructor(options = {}) {
        this.options = {
            filename: 'vue-ssr-client-manifest.json',
            ...options
        };
    }

    apply(compiler) {
        // Hook into compiler right before compilation is sealed so we get full stats object
        compiler.hooks.make.tap('vue-client-plugin', (compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: 'generate-client-manifest',
                    stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
                },
                () => {
                    const stats = compilation.getStats().toJson();
                    const manifest = {
                        publicPath: stats.publicPath,
                        all: [...new Set(stats.assets.map((a) => a.name))],
                        modules: {
                            /* [identifier: string]: Array<index: number> */
                        },
                    };
                    const assetModules = stats.modules.filter((m) => m.assets.length);
                    const fileToIndex = (file) => manifest.all.indexOf(file);

                    stats.modules.forEach((m) => {
                        if (m.chunks.length === 1) {
                            let cid = m.chunks[0];
                            let chunk = stats.chunks.find((c) => c.id === cid);

                            if (!chunk || !chunk.files) {
                                return;
                            }
                            /* use only 'base' filepath */
                            const id = m.identifier.replace(/\|.*/, '').split('!').pop();
                            let files = (manifest.modules[hash(id)] = chunk.files.map(
                                fileToIndex
                            ));

                            assetModules.forEach((m) => {
                                if (m.chunks.some((id) => id === cid)) {
                                    files.push.apply(files, m.assets.map(fileToIndex));
                                }
                            });
                        }
                    });
                    const json = JSON.stringify(manifest, null, 2);
                    compilation.assets[this.options.filename] = {
                        source: function() {
                            return json;
                        },
                        size: function() {
                            return json.length;
                        },
                    };
                }
            )
        });
    }
}

exports.VueSSRClientPlugin = VueSSRClientPlugin;
