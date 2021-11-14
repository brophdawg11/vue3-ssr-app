import { createSSRApp } from 'vue';

import createRouter from './router';

import App from './App.vue';

export default function createApp(history) {
    const app = createSSRApp(App);
    const router = createRouter(history);

    app.use(router);

    return { app, router };
}
