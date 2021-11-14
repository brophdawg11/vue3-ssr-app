<template>
    <div>
        <h1>Page 1</h1>
        <p>Count: {{ count }}</p>
        <button @click="count++">Increment</button>
    </div>
</template>

<script>
export default {
    name: 'Page 1',
    data() {
        return {
            count: 0,
        };
    }
}
</script>
