import { createRouter } from 'vue-router'

const routes = [{
    name: 'page1',
    path: '/',
    component: () => import(/* webpackChunkName: "page1" */ './Page1.vue'),
}, {
    name: 'page2',
    path: '/page-2',
    component: () => import(/* webpackChunkName: "page2" */ './Page2.vue'),
}];

export default function createAppRouter(history) {
    return createRouter({
        history,
        routes,
    });
}
