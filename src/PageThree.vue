<template>
    <div>
        <h1>Page 3</h1>
        <p>Local Count: {{ count }}</p>
        <button @click="count++">
            Increment
        </button>
        <p>Store Count: {{ $store.state.count }}</p>
        <button @click="$store.commit('increment')">
            Increment
        </button>
        <p>Route Store Count: {{ $store.state.three.count }}</p>
        <button @click="$store.commit('three/increment')">
            Increment
        </button>
    </div>
</template>

<script>
import { ref } from 'vue';

export default {
    name: 'PageThree',
    vuex: {
        moduleName: 'three',
        module: {
            namespaced: true,
            state: () => ({
                count: 0,
            }),
            /* eslint-disable no-param-reassign */
            mutations: {
                increment(state) {
                    state.count++;
                },
            },
            /* eslint-enable no-param-reassign */
        },
    },
    async fetchData({ store }) {
        await new Promise((r) => {
            setTimeout(r, 1000);
        });
        store.commit('increment');
        store.commit('three/increment');
    },
    setup() {
        const count = ref(0);
        return {
            count,
        };
    },
};
</script>
