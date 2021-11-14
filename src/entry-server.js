import { createMemoryHistory } from 'vue-router'

import createApp from './create-app';

export default async function (context) {
    const { app, router } = createApp(createMemoryHistory());

    await router.push(context.url)
    await router.isReady()

    return { app };
}
