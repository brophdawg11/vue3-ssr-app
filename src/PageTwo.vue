<template>
    <div>
        <h1>Page 2</h1>
        <p>Local Count: {{ count }}</p>
        <button @click="count++">
            Increment
        </button>
        <p>Store Count: {{ $store.state.count }}</p>
        <button @click="$store.commit('increment')">
            Increment
        </button>
    </div>
</template>

<script>
import { ref } from 'vue';

export default {
    name: 'PageTwo',
    async fetchData({ store }) {
        await new Promise((r) => {
            setTimeout(r, 1000);
        });
        store.commit('increment');
    },
    setup() {
        const count = ref(0);
        return {
            count,
        };
    },
};
</script>
