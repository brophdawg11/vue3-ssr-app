import createApp from './create-app';

export default function () {
    const { app } = createApp();

    return { app };
}
