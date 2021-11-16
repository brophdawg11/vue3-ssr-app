import { createWebHistory } from 'vue-router';

import createApp from './create-app';
import { getMatchedComponents, getModuleName, safelyRegisterModule } from './entry-utils';

// TODO: Quick placeholders for lodash functions
const isFunction = f => typeof f === 'function';
function isEqual(a, b) {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
        return false;
    }
}
function sortBy(arr, fn) {
    return arr.sort((a, b) => {
        if (fn(a) < fn(b)) {
            return -1;
        }
        if (fn(a) > fn(b)) {
            return 1;
        }
        return 0;
    });
}

const logger = console;
// By default, only run fetchData middlewares on path changes
const shouldProcessRouteUpdateDefaults = {
    path: true,
    query: false,
    hash: false,
};

const initialState = JSON.parse(window.initialState);
const { app, router, store } = createApp(createWebHistory(), initialState);

window.app = app;
window.router = router;
window.store = store;

/**
 * Determine if we should run our middlewares and fetchData for a given routing
 * operation.  This is a component-level specification that has two formats:
 *
 * // Object-shorthand
 * shouldProcessrouteUpdate: {
 *     path: true,    // Process updates if route.path changes
 *     query: false,  // Do not process route.query changes
 *     hash: false,   // Do not process route.hash changes
 * }
 *
 * // Function long form
 * shouldProcessRouteUpdate(fetchDataArgs) {
 *     // View-specific complex logic here
 * }
 *
 * You can also provide global defaults for the object shorthand via the config
 * options in initializeClient.  If not passed, they will default to the above
 * (only process path changes)
 *
 * @param   {object} c             Vue component definition object for destination route
 * @param   {object} fetchDataArgs Context argument passed to fetchData
 * @param   {object} spruDefaults  Defaults from initializeClient
 * @returns {boolean}              True if we should process this route update through the
 *                                 fetchData/middleware pipeline
 */
function shouldProcessRouteUpdate(c, fetchDataArgs, spruDefaults) {
    const { from, route } = fetchDataArgs;

    // Always process route updates when going between routing table entries
    if (from?.name !== route?.name) {
        return true;
    }

    // If the component specifies a function, use it
    if (isFunction(c.shouldProcessRouteUpdate)) {
        return c.shouldProcessRouteUpdate(fetchDataArgs) === true;
    }

    // Otherwise, use the defaults and override with any component opts.  Shallow
    // clone here so we don't persist anything from route to route
    const { path, query, hash } = {
        ...spruDefaults,
        ...c.shouldProcessRouteUpdate,
    };

    return (
        (path === true && from?.path !== route?.path) ||
        (query === true && !isEqual(from?.query, route?.query)) ||
        (hash === true && from?.hash !== route?.hash)
    );
}

const queuedRemovalModules = [];

// Before routing, register any dynamic Vuex modules for new components
router.beforeResolve((to, from, next) => {
    try {
        const fetchDataArgs = { app, route: to, router, store, from };
        getMatchedComponents(to)
            .filter(c => 'vuex' in c)
            .filter(c => shouldProcessRouteUpdate(
                c,
                fetchDataArgs,
                shouldProcessRouteUpdateDefaults,
            ))
            .flatMap(c => c.vuex)
            .forEach((vuexModuleDef) => {
                const name = getModuleName(vuexModuleDef, to);
                safelyRegisterModule(store, name, vuexModuleDef.module, logger);
            });

        next();
    } catch (e) {
        logger.error('Caught error during beforeResolve', e);
        // Prevent routing
        next(e || false);
    }
});

// After routing, unregister any dynamic Vuex modules from prior components
router.afterEach((to, from) => {
    const fetchDataArgs = { app, route: to, router, store, from };
    const shouldProcess = getMatchedComponents(to)
        .filter(c => shouldProcessRouteUpdate(
            c,
            fetchDataArgs,
            shouldProcessRouteUpdateDefaults,
        ))
        .length > 0;

    if (!shouldProcess) {
        return;
    }

    // Determine "active" modules from the outgoing and incoming routes
    const toModuleNames = getMatchedComponents(to)
        .filter(c => 'vuex' in c)
        .flatMap(c => c.vuex)
        .map(vuexModuleDef => getModuleName(vuexModuleDef, to));
    const fromModuleNames = getMatchedComponents(from)
        .filter(c => 'vuex' in c)
        .flatMap(c => c.vuex)
        .map(vuexModuleDef => getModuleName(vuexModuleDef, from));

    // Unregister any modules we queued for removal on the previous route
    const requeueModules = [];
    while (queuedRemovalModules.length > 0) {
        // Unregister from the end of the queue, so we go upwards from child
        // components to parent components in nested route scenarios
        const name = queuedRemovalModules.pop();
        const nameArr = name.split('/');
        if ([...toModuleNames, ...fromModuleNames].includes(name)) {
            // Can't remove yet - still actively used.  Queue up for the next route
            logger.info(`Skipping deregistration for active dynamic Vuex module: ${name}`);
            requeueModules.push(name);
        } else if (store.hasModule(nameArr)) {
            logger.info(`Unregistering dynamic Vuex module: ${name}`);
            store.unregisterModule(nameArr);
        } else {
            logger.info(`No existing dynamic module to unregister: ${name}`);
        }
    }

    // Queue up the prior route modules for removal on the next route
    const nextRouteRemovals = [...new Set([...requeueModules, ...fromModuleNames])];
    // Sort by depth, so that we remove deeper modules first using .pop()
    const sortedRouteRemovals = sortBy(nextRouteRemovals, [m => m.split('/').length]);
    queuedRemovalModules.push(...sortedRouteRemovals);
});

router.isReady().then(() => {

    router.beforeResolve(async (to, from, next) => {
        const fetchDataArgs = { app, route: to, router, store, from };
        try {
            const components = to.matched.flatMap(r => Object.values(r.components));
            await Promise.all(components.map(c => c?.fetchData(fetchDataArgs)));
            next();
        } catch (e) {
            next(e);
        }
    });

    app.mount('#app');
});
