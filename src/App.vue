<template>
    <div id="app">
        <h1>Current user is: {{ user }}</h1>
        <p>Count: {{ count }}</p>
        <button @click="count++">Increment</button>
    </div>
</template>

<script>
export default {
    name: 'App',
    data() {
        return {
            count: 0,
            user: 'John Doe'
        };
    }
}
</script>
