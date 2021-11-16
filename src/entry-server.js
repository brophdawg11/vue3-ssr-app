import { createMemoryHistory } from 'vue-router';

import { useFetchDataServer, useRouteVuexModulesServer } from './entry-utils';

import createApp from './create-app';

const logger = console;
const middleware = () => logger.log('Inside middleware');
const globalFetchData = () => logger.log('Inside globalFetchData');
const postMiddleware = () => logger.log('Inside postMiddleware');

export default async function serverCreateApp(context) {
    const { app, router, store } = createApp(createMemoryHistory());

    await router.push(context.url);
    await router.isReady();

    useRouteVuexModulesServer(router, store, logger);

    await useFetchDataServer(context, app, router, store, {
        middleware,
        globalFetchData,
        postMiddleware,
    });

    // Stringify so we can use JSON.parse for performance.
    //   Double stringify to properly escape characters. See:
    //   https://v8.dev/blog/cost-of-javascript-2019#json
    context.initialState = JSON.stringify(JSON.stringify(
        store.state,
        // Custom JSON.stringify replacer function to do 2 things:
        // * Convert any `_ssr_` prefixed keys to undefined values so
        //   they get stripped.  These properties are strictly for SSR
        //   memoization of non-reactive expensive getter methods
        // * Convert all undefined values to null's during stringification.
        //   Default behavior of JSON.stringify is to strip undefined values,
        //   which breaks client side hydration because Vue won't make the
        //   property reactive. See:
        //     https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description
        (k, v) => {
            if (k.startsWith('_ssr_')) {
                return undefined;
            }
            if (v === undefined) {
                return null;
            }
            return v;
        },
    ));

    return { app };
}
