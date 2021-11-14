import { createWebHistory } from 'vue-router';

import createApp from './create-app';

const { app, router } = createApp(createWebHistory());

router.isReady().then(() => {
    app.mount('#app')
});
