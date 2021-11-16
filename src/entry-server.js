import { createMemoryHistory } from 'vue-router';

import { useFetchDataServer, useRouteVuexModulesServer } from './entry-utils';

import createApp from './create-app';

export default async function serverCreateApp(context) {
    const { app, router, store } = createApp(createMemoryHistory());
    const logger = console;

    await router.push(context.url);
    await router.isReady();

    useRouteVuexModulesServer(router, store, logger);

    useFetchDataServer(context, app, router, store);

    context.initialState = JSON.stringify(JSON.stringify(store.state));

    return { app };
}
