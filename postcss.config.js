/* eslint-disable global-require, import/no-extraneous-dependencies */

module.exports = ({ options }) => ({
    plugins: [
        ...(options.minimize ? [require('cssnano')({ preset: 'default' })] : []),
    ],
});
