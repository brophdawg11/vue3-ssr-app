'use strict';

// SSR webpack loader to inject code that will populate ssrContext._registeredComponents
// with the webpack module/chunk hash when a given component is rendered during SSR.
// Knowing _what_ components actually render during SSR allows us to cross-reference the
// client manifest in order to add the proper <link rel="preload">/<script> tags in the
// SSR HTML
//
// See:
//   https://stackoverflow.com/a/64631510/3524793
//   https://github.com/raukaute/vue-hackernews-3.0

var __importDefault = (this && this.__importDefault) || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
};

Object.defineProperty(exports, '__esModule', { value: true });

const hash_sum_1 = __importDefault(require('hash-sum'));
const IS_SETUP_RE = /export function setup/;

function loader(source) {
    const loaderContext = this;
    const { resourcePath } = loaderContext;
     //@ TODO: this regexp could be nicer
    const { index } = source.match(/(?<=export.*)\r?\n/);
    const id = hash_sum_1.default(resourcePath);
    const isSetup = IS_SETUP_RE.test(source);
    const code = isSetup ?
      `const ctx = useSSRContext(); ctx._registeredComponents.add(${JSON.stringify(id)});` :
      `beforeCreate: function() { const ctx = useSSRContext(); ctx._registeredComponents.add(${JSON.stringify(id)}); },`;
    return (
        'import { useSSRContext } from "vue";\n' +
        [source.slice(0, index + 1), code, source.slice(index + 1)].join(' ')
    );
}

exports.default = loader;
