import { createSSRApp } from 'vue';

import createRouter from './router';
import createStore from './store';

import App from './App.vue';

export default function createApp(history, initialState) {
    const app = createSSRApp(App);

    const router = createRouter(history);
    app.use(router);

    const store = createStore(initialState);
    app.use(store);

    return { app, router, store };
}
