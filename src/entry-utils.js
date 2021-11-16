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

// Return matched components for the given route
function getMatchedComponents(route) {
    return route.matched.flatMap(r => Object.values(r.components));
}

// Allow a function to be passed that can generate a route-aware module name
function getModuleName(vuexModuleDef, route) {
    const name = typeof vuexModuleDef.moduleName === 'function' ?
        vuexModuleDef.moduleName({ $route: route }) :
        vuexModuleDef.moduleName;
    return name;
}

// Return the namespaced module state
function getModuleState(store, nameArr) {
    return nameArr.reduce((acc, k) => (acc ? acc[k] : null), store.state);
}

// Register a module only if it does not exist yet
function safelyRegisterModule(store, name, vuexModule, logger) {
    const nameArr = name.split('/');
    if (store.hasModule(nameArr)) {
        logger.info(`Skipping duplicate dynamic Vuex module registration: ${name}`);
    } else {
        logger.info(`Registering dynamic Vuex module: ${name}`);
        store.registerModule(nameArr, vuexModule, {
            preserveState: getModuleState(store, nameArr) != null,
        });
    }
}

// Return a consistent structure for the object passed to fetchData and related hooks
// TODO: Make middlewares accept this format
function getFetchDataArgs(ssrContext, app, router, store, to, from) {
    return {
        ssrContext,
        app,
        from,
        route: to,
        router,
        store,
    };
}

/**
 * Register any dynamic Vuex modules.  Registering the store
 * modules as part of the component allows the module to be bundled
 * with the async-loaded component and not in the initial root store
 * bundle
 *
 * @param   {object} route  Destination route object
 * @param   {object} store  Vuex Store instance
 * @param   {object} logger Logger instance
 * @returns {undefined}     No return value
 */
export function useRouteVuexModulesServer(router, store, logger) {
    const route = router.currentRoute.value;
    getMatchedComponents(route)
        .filter(c => 'vuex' in c)
        .flatMap(c => c.vuex)
        .forEach((vuexModuleDef) => {
            const name = getModuleName(vuexModuleDef, route);
            safelyRegisterModule(store, name, vuexModuleDef.module, logger);
        });
}

// Run middlewares + fetchData for the given route
async function runFetchData(components, fetchDataArgs, opts) {
    if (opts?.middleware) {
        await opts.middleware(fetchDataArgs);
    }
    const results = await Promise.all([
        opts?.globalFetchData(fetchDataArgs),
        ...components.map(c => c?.fetchData(fetchDataArgs)),
    ]);
    if (opts?.postMiddleware) {
        await opts.postMiddleware(fetchDataArgs);
    }
    return results;
}

/**
 * Wire up server-side fetchData/globalFetchData execution for current route components
 *
 * @param   {object} ssrContext Server SSR context object
 * @param   {object} app        App instance
 * @param   {object} router     Router instance
 * @param   {object} store      Vuex store instance
 * @param   {object} opts                 Additional options
 * @param   {object} opts.middleware      Function to execute before fetchData
 * @param   {object} opts.postMiddleware  Function to execute after fetchData
 * @returns {undefined}         No return value
 */
export async function useFetchDataServer(ssrContext, app, router, store, opts) {
    const route = router.currentRoute.value;
    const fetchDataArgs = getFetchDataArgs(ssrContext, app, router, store, route);
    const components = getMatchedComponents(route);
    await runFetchData(components, fetchDataArgs, opts);
}

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
 * @returns {boolean}              True if we should process this route update through the
 *                                 fetchData/middleware pipeline
 */
function shouldProcessRouteUpdate(c, fetchDataArgs) {
    // By default, only run fetchData middlewares on path changes
    const shouldProcessRouteUpdateDefaults = {
        path: true,
        query: false,
        hash: false,
    };

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
        ...shouldProcessRouteUpdateDefaults,
        ...c.shouldProcessRouteUpdate,
    };

    return (
        (path === true && from?.path !== route?.path) ||
        (query === true && !isEqual(from?.query, route?.query)) ||
        (hash === true && from?.hash !== route?.hash)
    );
}

export function useRouteVuexModulesClient(app, router, store, logger) {
    const queuedRemovalModules = [];

    // Before routing, register any dynamic Vuex modules for new components
    router.beforeResolve((to, from, next) => {
        try {
            const fetchDataArgs = getFetchDataArgs(null, app, router, store, to, from);
            getMatchedComponents(to)
                .filter(c => 'vuex' in c)
                .filter(c => shouldProcessRouteUpdate(c, fetchDataArgs))
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
        const fetchDataArgs = getFetchDataArgs(null, app, router, store, to, from);
        const shouldProcess = getMatchedComponents(to)
            .filter(c => shouldProcessRouteUpdate(c, fetchDataArgs))
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
}

/**
 * Wire up client-side fetchData/globalFetchData execution for current route components
 *
 * @param   {object} app                  App instance
 * @param   {object} router               Router instance
 * @param   {object} store                Vuex store instance
 * @param   {object} logger               Logger instance
 * @param   {object} opts                 Additional options
 * @param   {object} opts.middleware      Function to execute before fetchData
 * @param   {object} opts.postMiddleware  Function to execute after fetchData
 * @returns {undefined}                   No return value
 */
export function useFetchDataClient(app, router, store, logger, opts) {
    // Prior to resolving a route, execute any component fetchData methods.
    // Approach based on:
    //   https://ssr.vuejs.org/en/data.html#client-data-fetching
    router.beforeResolve(async (to, from, next) => {
        const routeUpdateStr = `${from.fullPath} -> ${to.fullPath}`;
        const fetchDataArgs = getFetchDataArgs(null, app, router, store, to, from);
        try {
            const components = getMatchedComponents(to)
                .filter(c => shouldProcessRouteUpdate(c, fetchDataArgs));

            // Short circuit if none of our components need to process the route update
            if (components.length === 0) {
                logger.debug(`Ignoring route update ${routeUpdateStr}`);
                next();
                return;
            }

            logger.debug(`Running middleware/fetchData for route update ${routeUpdateStr}`);
            const results = await runFetchData(components, fetchDataArgs, opts);

            // Call next with the first non-null resolved value from fetchData
            next(results.find(r => r != null));
        } catch (e) {
            next(e);
        }
    });
}
