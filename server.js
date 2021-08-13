const {ApolloServer} = require('apollo-server-express')
const express = require('express')
const session = require('express-session')
const cors = require('cors')
const Logger = require('coa-node-logging')
const cache = require('coa-web-cache')
const {checkLogin, initializeContext, getUserInfo} = require('coa-web-login')
const MemoryStore = require('memorystore')(session)
const PgSession = require('connect-pg-simple')(session)
const getDbConnection = require('./common/db')

require('dotenv').config()

const logFile = process.env.logfile ? process.env.logfile : null
const logger = new Logger('checkins', logFile)

logger.info('Logging Initialized')


//const GRAPHQL_PORT = process.env.PORT || 4000;

logger.info('Connect to mdastore1')
getDbConnection('mds'); // Initialize the connection.

logger.info('Connect to reviews database')
//const pool = new PgPool(reviewsConfig)
getDbConnection('reviews');
logger.info('Database connections initialized')

const GRAPHQL_PORT = process.env.PORT || 3000

const graphQLServer = express().use('*', cors())

const app = express();

let sessionCache = null;
logger.info('start session')
const prunePeriod = 86400000; // prune expired entries every 24h
const sessionCacheMethod = process.env.session_cache_method || 'memory';
if (sessionCacheMethod === 'memory') {
    sessionCache = new MemoryStore({
        checkPeriod: prunePeriod,
    });
} else if (sessionCacheMethod === 'pg') {
    sessionCache = new PgSession({
        pool: getDbConnection('mds'),
        schemaName: 'aux',
        ttl: prunePeriod,
    });
} else {
    throw new Error(`Unknown caching method ${sessionCacheMethod}`);
}
logger.info('caching initialized')

// Initialize session management
app.use(session({
    name: process.env.sessionName,
    secret: process.env.sessionSecret,
    resave: false,
    saveUninitialized: true,
    store: sessionCache,
    cookie: {
        httpOnly: true,
        secure: 'auto',
        maxAge: 1000 * 60 * 60 * 24 * process.env.maxSessionDays,
    },
}));
logger.info('session handling initialized')

// Set up CORS
const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,
};
app.use(cors(corsOptions));
logger.info('set up cors')
// Check whether the user is logged in
app.use((req, res, next) => {
    const sessionId = req.session.id;
    cache.get(sessionId)
        .then((cData) => {
            let ensureInCache = Promise.resolve(null);
            const cachedContext = cData || initializeContext();
            if (!cData) {
                ensureInCache = cache.store(sessionId, cachedContext);
            }
            ensureInCache.then(() => {
                checkLogin(sessionId, cachedContext, cache)
                    .then(() => getUserInfo(sessionId, cachedContext, cache, getDbConnection('mds')))
                    .then((uinfo) => {
                        req.session.employee_id = uinfo.id;
                        return next();
                    })
                    .catch((err) => {
                        const error = new Error(err.toString().substring(6));
                        error.httpStatusCode = 403;
                        error.stack = null;
                        return next(error);
                    });
            });
        });
});
logger.info('cache session')

// Now configure and apply the GraphQL server

const typeDefs = require('./schema');
const resolvers = require('./resolvers');
logger.info('set up server')
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({req}) => ({
        sessionId: req.session.id,
        session: req.session,
        cache,
    }),
});

logger.info(`Start listening on port ${GRAPHQL_PORT}`)

server.applyMiddleware({app, cors: corsOptions});

// And off we go!
app.listen({port: GRAPHQL_PORT}, () => {
    console.log(`Server ready at http://localhost:${GRAPHQL_PORT}${server.graphqlPath}`);
});
