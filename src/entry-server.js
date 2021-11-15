import { createMemoryHistory } from 'vue-router';

import createApp from './create-app';

export default async function serverCreateApp(context) {
    const { app, router, store } = createApp(createMemoryHistory());

    await router.push(context.url);
    await router.isReady();

    const components = router.currentRoute.value.matched.flatMap(r => Object.values(r.components));

    const fetchDataArgs = {
        ssrContext: context,
        app,
        route: router.currentRoute,
        router,
        store,
    };
    await Promise.all(components.map(c => c?.fetchData(fetchDataArgs)));

    context.initialState = JSON.stringify(JSON.stringify(store.state));

    return { app };
}
