import { createMemoryHistory } from 'vue-router';

import { getMatchedComponents, getModuleName, safelyRegisterModule } from './entry-utils';
import createApp from './create-app';

export default async function serverCreateApp(context) {
    const { app, router, store } = createApp(createMemoryHistory());
    const logger = console;

    await router.push(context.url);
    await router.isReady();

    const components = getMatchedComponents(router.currentRoute.value);

    // Register any dynamic Vuex modules.  Registering the store
    // modules as part of the component allows the module to be bundled
    // with the async-loaded component and not in the initial root store
    // bundle
    components
        .filter(c => 'vuex' in c)
        .flatMap(c => c.vuex)
        .forEach((vuexModuleDef) => {
            const name = getModuleName(vuexModuleDef, router.currentRoute);
            safelyRegisterModule(store, name, vuexModuleDef.module, logger);
        });

    const fetchDataArgs = {
        ssrContext: context,
        app,
        route: router.currentRoute,
        router,
        store,
    };

    // TODO: middleware()

    await Promise.all([
        // TODO: globalFetchData(),
        ...components.map(c => c?.fetchData(fetchDataArgs)),
    ]);

    // TODO: postMiddleware()

    context.initialState = JSON.stringify(JSON.stringify(store.state));

    return { app };
}
