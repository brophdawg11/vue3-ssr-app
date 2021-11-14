import { createSSRApp } from 'vue';

import App from './App.vue';

export default function createApp() {
    const app = createSSRApp(App);
    return { app };
}
