import { createRouter } from 'vue-router';

const routes = [{
    name: 'page1',
    path: '/',
    component: () => import(/* webpackChunkName: "page-one" */ './PageOne.vue'),
}, {
    name: 'page2',
    path: '/page-2',
    component: () => import(/* webpackChunkName: "page-two" */ './PageTwo.vue'),
}];

export default function createAppRouter(history) {
    return createRouter({
        history,
        routes,
    });
}
