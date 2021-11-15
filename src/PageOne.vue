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
    </div>
</template>

<script>
export default {
    name: 'PageOne',
    async fetchData({ store }) {
        await new Promise((r) => {
            setTimeout(r, 1000);
        });
        store.commit('increment');
    },
    data() {
        return {
            count: 0,
        };
    },
};
</script>
