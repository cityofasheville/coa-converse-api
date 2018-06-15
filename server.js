const express = require('express');
const { apolloExpress, graphiqlExpress } = require('apollo-server');
const { makeExecutableSchema } = require('graphql-tools');
const bodyParser = require('body-parser');
const cors = require('cors');
const Logger = require('coa-node-logging');
const coaWebLogin = require('coa-web-login');
require('dotenv').config();

const logFile = process.env.logfile ? process.env.logfile : null;
const logger = new Logger('checkins', logFile);
const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const executableSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

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

logger.info('Connect to database');

const whPool = new PgPool(whConfig);

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
    whPool,
    logger,
    user: {
      loggedin: false,
      token: null,
      uid: null,
      name: null,
      email: null,
    },
    employee: {
      employee_id: 0,
      department: null,
      division: null,
      groups: [],
    },
    superuser: false,
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
  return coaWebLogin(whPool, logger, req)
  .then(userInfo => {
    baseConfig.context.user = userInfo.user;
    baseConfig.context.employee = userInfo.employee;
    logger.info(`Employee id for login ${baseConfig.context.user.email} is ${baseConfig.context.employee.employee_id}`);
    return pool.request()
    .query(`SELECT TOP(1) * FROM dbo.SuperUsers WHERE EmpID = ${baseConfig.context.employee.employee_id}`)
    .then(res2 => {
      let superuser = false;
      if (res2.recordset.length === 1) {
        superuser = res2.recordset[0].IsSuperUser !== 0;
      }
      baseConfig.context.superuser = superuser;
      if (superuser) logger.warn(`Superuser login by ${baseConfig.context.user.email}'`);
      return baseConfig;
    })
    .catch(error => {
      logger.error(error);
      return baseConfig;
    });
  });
}));

graphQLServer.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
}));

logger.info(`Start listening on port ${GRAPHQL_PORT}`);

graphQLServer.listen(GRAPHQL_PORT, () => logger.info(
  `Check-Ins: GraphQL Server is now running on http://localhost:${GRAPHQL_PORT}/graphql`
));

