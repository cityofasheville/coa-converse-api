const express = require('express');
const { apolloExpress, graphiqlExpress } = require('apollo-server');
const { makeExecutableSchema } = require('graphql-tools');
const bodyParser = require('body-parser');
const cors = require('cors');
const Logger = require('coa-node-logging');
require('dotenv').config();

const logFile = process.env.logfile ? process.env.logfile : null;
const logger = new Logger('checkins', logFile);
const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const executableSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Import Firebase - for now (8/25/16), the use of require and import of individual
// submodules is needed to avoid problems with webpack (import seems to require
// beta version of webpack 2).
logger.info('Initialize firebase');
const firebase = require('firebase');
firebase.initializeApp({
  serviceAccount: './coa-converse-firebase-adminsdk-sd9yz-05a18e6d38.json',
  databaseURL: 'https://coa-converse.firebaseio.com',
});
logger.info('Firebase initialized');

const pg = require('pg');
pg.defaults.poolSize = 1;
const PgPool = pg.Pool;

const whConfig = {
  host: process.env.wh_dbhost,
  user: process.env.wh_dbuser,
  password: process.env.wh_dbpassword,
  database: process.env.wh_database,
  port: 5432,
  ssl: false,
};

logger.info('Connect to mdastore1');

const whPool = new PgPool(whConfig);

const reviewsConfig = {
  host: process.env.dbhost,
  user: process.env.dbuser,
  password: process.env.dbpassword,
  database: process.env.database,
  port: 5432,
  ssl: false,
};
logger.info('Connect to reviews database');
const pool = new PgPool(reviewsConfig);

logger.info('Database connections initialized');

const GRAPHQL_PORT = process.env.PORT || 8080;

const graphQLServer = express().use('*', cors());
const baseConfig = {
  schema: executableSchema,
  context: {
    pool,
    whPool,
    logger,
    employee_id: 0,
    superuser: false,
    loggedin: false,
    token: null,
    uid: null,
    name: null,
    email: null,
    groups: [],
    subscriptions: null,
  },
};
logger.info('Initialize graphql server');
graphQLServer.use('/graphql', bodyParser.json(), apolloExpress((req, res) => {
  logger.info('New client connection');
  if (!req.headers.authorization || req.headers.authorization === 'null') {
    logger.warn('Client connection - not logged in');
    return baseConfig;
  }
  logger.info('Attempt login verification');
  return firebase.auth().verifyIdToken(req.headers.authorization)
  .then(decodedToken => {
    const decodedEmail = decodedToken.email.toLowerCase();
    logger.info(`Logging in ${decodedEmail} - look up employee ID`);
    // Now we need to look up the employee ID
    const query = 'select emp_id from internal.ad_info where email_city = $1';
    return whPool.query(query, [decodedEmail])
    .then(res1 => {
      if (res1.rows.length !== 1) {
        logger.error(`Unable to match employee by email ${decodedEmail}`);
        throw new Error('Unable to find employee by email.');
      }
      const employeeId = res1.rows[0].emp_id;
      logger.info(`Employee id for login ${decodedEmail} is ${employeeId}`);
      return pool
      .query(`SELECT * FROM reviews.superusers WHERE emp_id = ${employeeId}`)
      .then(res2 => {
        let superuser = false;
        if (res2.rows.length === 1) {
          superuser = res2.rows[0].is_superuser;
        }
        if (superuser) logger.warn(`Superuser login by ${decodedToken.email}'`);
        return {
          schema: executableSchema,
          context: {
            pool,
            whPool,
            logger,
            employee_id: employeeId,
//            employee_id: 1316,
            superuser,
            loggedin: true,
            token: req.headers.authorization,
            uid: decodedToken.uid,
            name: decodedToken.name,
            email: decodedToken.email,
          },
        };
      });
    });
  })
  .catch((error) => {
    if (req.headers.authorization !== 'null') {
      logger.error(`Error decoding authentication token: ${error}`);
    }
    return baseConfig;
  });
}));

graphQLServer.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
}));

logger.info(`Start listening on port ${GRAPHQL_PORT}`);

graphQLServer.listen(GRAPHQL_PORT, () => logger.info(
  `Check-Ins: GraphQL Server is now running on http://localhost:${GRAPHQL_PORT}/graphql`
));

