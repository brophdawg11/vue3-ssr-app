import { createStore } from 'vuex';

export default function createAppStore(initialState) {
    const store = createStore({
        strict: true,
        state: {
            count: 0,
        },
        /* eslint-disable no-param-reassign */
        mutations: {
            increment(state) {
                state.count++;
            },
        },
        /* eslint-enable no-param-reassign */
    });

    if (initialState) {
        store.replaceState(initialState);
    }

    return store;
}
