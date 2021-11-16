<template>
    <div>
        <h1>Page 1</h1>
        <p>Local Count: {{ count }}</p>
        <button @click="count++">
            Increment
        </button>
        <p>Store Count: {{ $store.state.count }}</p>
        <button @click="$store.commit('increment')">
            Increment
        </button>
        <p>Route Store Count: {{ $store.state.one.count }}</p>
        <button @click="$store.commit('one/increment')">
            Increment
        </button>
        <br>
        <router-link :to="{ name: 'page1', query: { v: '1' } }">
            Intra-page link (fetchData ignored)
        </router-link>
        <br>
        <router-link :to="{ name: 'page1', query: { v: '2' } }">
            Intra-page link (fetchData processed)
        </router-link>
    </div>
</template>

<script>
export default {
    name: 'PageOne',
    vuex: {
        moduleName: 'one',
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
    shouldProcessRouteUpdate({ route }) {
        return route.query.v === '2';
    },
    async fetchData({ store }) {
        await new Promise((r) => {
            setTimeout(r, 1000);
        });
        store.commit('increment');
        store.commit('one/increment');
    },
    data() {
        return {
            count: 0,
        };
    },
};
</script>
