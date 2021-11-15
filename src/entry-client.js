import { createWebHistory } from 'vue-router';

import createApp from './create-app';

const initialState = JSON.parse(window.initialState);
const { app, router, store } = createApp(createWebHistory(), initialState);

window.app = app;
window.router = router;
window.store = store;

router.isReady().then(() => {

    router.beforeResolve(async (to, from, next) => {
        const fetchDataArgs = { app, route: to, router, store, from };
        try {
            const components = to.matched.flatMap(r => Object.values(r.components));
            await Promise.all(components.map(c => c?.fetchData(fetchDataArgs)));
            next();
        } catch (e) {
            next(e);
        }
    });

    app.mount('#app')
});
