import { createStore } from 'vuex';

export default function createAppStore(initialState) {
    const store = createStore({
        strict: true,
        state: {
            count: 0,
        },
        mutations: {
            increment(state) {
                state.count++;
            },
        },
    });

    if (initialState) {
        store.replaceState(initialState);
    }

    return store;
}
