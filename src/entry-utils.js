// To be toggled on via perfInit if desired
const PERF_PREFIX = 'urbnperf';
const perfAvailable = (
    typeof window !== 'undefined' &&
    window.performance !== null &&
    window.performance.getEntriesByType
);

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

// Look up the current perf mark of the format urbnperf|*|start
function getCurrentPerfMark() {
    return window.performance.getEntriesByType('mark')
        .find(m => m.name.startsWith(PERF_PREFIX) && m.name.endsWith('start'));
}

// Initialize perf tracking for a new client-side route
function perfInit(to, from) {
    if (!perfAvailable) {
        return;
    }

    // Always clear any prior measurements before starting a new one
    window.performance.getEntriesByType('mark')
        .filter(m => m.name.startsWith(PERF_PREFIX))
        .forEach(m => window.performance.clearMarks(m.name));

    window.performance.getEntriesByType('measure')
        .filter(m => m.name.startsWith(PERF_PREFIX))
        .forEach(m => window.performance.clearMeasures(m.name));

    // Start a new routing operation with a mark such as:
    //   urbnperf|Homepage->Catch-All|start
    window.performance.mark(`${PERF_PREFIX}|${from.name}->${to.name}|start`);
}

// Issue a performance.measure call for the given name using the most recent
// 'start' mark
export function perfMeasure(name) {
    if (!perfAvailable) {
        return false;
    }

    const mark = getCurrentPerfMark();
    if (!mark) {
        // Can't measure if we don't have a starting mark to measure from
        return false;
    }

    // Add a measurement from the start mark with the current name.  Example:
    //     urbnperf|Homepage->Catch-All|done
    const [prefix, route] = mark.name.split('|');
    window.performance.measure(`${prefix}|${route}|${name}`, mark.name);

    // return true here to indicate that we logged the measurement, but do not
    // attempt to return the measure object itself because it is not returned
    // from window.performance.measure according to the spec.  Some browsers
    // seem to return it our of convenience, but specifically mobile safari does
    // not
    return true;
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
    if (opts?.middleware) {
        await opts.middleware(fetchDataArgs);
    }
    await Promise.all([
        opts?.globalFetchData(fetchDataArgs),
        ...components.map(c => c?.fetchData(fetchDataArgs)),
    ]);
    if (opts?.postMiddleware) {
        await opts.postMiddleware(fetchDataArgs);
    }
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
    if (perfAvailable) {
        // Start perf tracking for this route
        router.beforeEach((to, from, next) => {
            const fetchDataArgs = getFetchDataArgs(null, app, router, store, to, from);
            const components = getMatchedComponents(to)
                .filter(c => shouldProcessRouteUpdate(c, fetchDataArgs));

            // Only measure performance for non-ignored route changed
            if (components.length > 0) {
                perfInit(to, from);
            }

            next();
        });
    }

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
            perfMeasure('beforeResolve');
            if (opts?.middleware) {
                await opts.middleware(fetchDataArgs);
            }
            perfMeasure('middleware-complete');
            const results = await Promise.all([
                opts?.globalFetchData(fetchDataArgs),
                ...components.map(c => c?.fetchData(fetchDataArgs)),
            ]);
            perfMeasure('fetchData-complete');
            if (opts?.postMiddleware) {
                await opts.postMiddleware(fetchDataArgs);
            }

            // Call next with the first non-null resolved value from fetchData
            next(results.find(r => r != null));
        } catch (e) {
            next(e);
        }
    });
}
