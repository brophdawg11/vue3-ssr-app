<template>
    <div>
        <h1>Page 2</h1>
        <p>Count: {{ count }}</p>
        <button @click="count++">Increment</button>
    </div>
</template>

<script>
import { ref } from 'vue';

export default {
    name: 'Page 2',
    setup() {
        const count = ref(0);
        return {
            count,
        };
    }
}
</script>
