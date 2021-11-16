import { createWebHistory } from 'vue-router';

import createApp from './create-app';
import { useFetchDataClient, useRouteVuexModulesClient } from './entry-utils';

const logger = console;
const { app, router, store } = createApp(createWebHistory(), window.initialState);

window.app = app;
window.router = router;
window.store = store;

const middleware = () => logger.log('Inside middleware');
const globalFetchData = () => logger.log('Inside globalFetchData');
const postMiddleware = () => logger.log('Inside postMiddleware');

useRouteVuexModulesClient(app, router, store, logger);

router.isReady().then(() => {
    useFetchDataClient(app, router, store, logger, {
        middleware,
        globalFetchData,
        postMiddleware,
    });
    app.mount('#app');
});
