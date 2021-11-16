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

    context.initialState = JSON.stringify(JSON.stringify(store.state));

    return { app };
}
