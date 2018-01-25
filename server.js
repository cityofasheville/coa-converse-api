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

const sql = require('mssql');
const msconfig = {
  user: process.env.dbuser,
  password: process.env.dbpassword,
  server: process.env.dbhost,
  database: process.env.database,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

logger.info('Connect to database');
const pool = new sql.ConnectionPool(msconfig);
pool.on('error', err => {
  throw new Error(`Error on database connection pool: ${err}`);
});

pool.connect(err => {
  if (err) {
    throw new Error(`Error trying to create a connection pool ${err}`);
  }
});

logger.info('Database connection initialized');

const GRAPHQL_PORT = process.env.PORT || 8080;

const graphQLServer = express().use('*', cors());
const baseConfig = {
  schema: executableSchema,
  context: {
    pool,
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
    logger.info(`Logging in ${decodedToken.email} - look up employee ID`);
    // Now we need to look up the employee ID
    const query = 'select EmpID from UserMap where Email = ' +
                  `'${decodedToken.email}' COLLATE SQL_Latin1_General_CP1_CI_AS`;
    return pool.request()
    .query(query)
    .then(res1 => {
      if (res1.recordset.length > 0) {
        return Promise.resolve(res1.recordset[0].EmpID);
      }
      logger.error(`Unable to match employee by email ${decodedToken.email}`);
      throw new Error('Unable to find employee by email.');
    })
    .then(employeeId => {
      logger.info(`Employee id for login ${decodedToken.email} is ${employeeId}`);
      return pool.request()
      .query(`SELECT TOP(1) * FROM dbo.SuperUsers WHERE EmpID = ${employeeId}`)
      .then(res2 => {
        let superuser = false;
        if (res2.recordset.length === 1) {
          superuser = res2.recordset[0].IsSuperUser !== 0;
        }
        if (superuser) logger.warn(`Superuser login by ${decodedToken.email}'`);
        return {
          schema: executableSchema,
          context: {
            pool,
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

