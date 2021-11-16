import { createWebHistory } from 'vue-router';

import createApp from './create-app';
import { useFetchDataClient, useRouteVuexModulesClient } from './entry-utils';

const logger = console;
const initialState = JSON.parse(window.initialState);
const { app, router, store } = createApp(createWebHistory(), initialState);

window.app = app;
window.router = router;
window.store = store;

useRouteVuexModulesClient(app, router, store, logger);

router.isReady().then(() => {
    useFetchDataClient(app, router, store, logger);
    app.mount('#app');
});
