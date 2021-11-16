<template>
    <div>
        <header>
            <router-link :to="{ name: 'page1' }">
                Page 1
            </router-link>
            |
            <router-link :to="{ name: 'page2' }">
                Page 2
            </router-link>
            |
            <router-link :to="{ name: 'page3' }">
                Page 3
            </router-link>
        </header>
        <router-view />
    </div>
</template>

<script>
export default {
    name: 'App',
};
</script>
