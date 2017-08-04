const express = require('express');
const { apolloExpress, graphiqlExpress } = require('apollo-server');
const { makeExecutableSchema } = require('graphql-tools');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const executableSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Import Firebase - for now (8/25/16), the use of require and import of individual
// submodules is needed to avoid problems with webpack (import seems to require
// beta version of webpack 2).
const firebase = require('firebase');
firebase.initializeApp({
  serviceAccount: './SimpliCityII-284f9d0ebb83.json',
  databaseURL: 'https://simplicityii-878be.firebaseio.com',
});

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

const pool = new sql.ConnectionPool(msconfig);
pool.on('error', err => {
  throw new Error(`Error on database connection pool: ${err}`);
});

pool.connect(err => {
  if (err) {
    throw new Error(`Error trying to create a connection pool ${err}`);
  }
});

const GRAPHQL_PORT = process.env.PORT || 8080;
console.log(`The graphql port is ${GRAPHQL_PORT}`);
const graphQLServer = express().use('*', cors());
const baseConfig = {
  schema: executableSchema,
  context: {
    pool,
    employee_id: '1316',
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

graphQLServer.use('/graphql', bodyParser.json(), apolloExpress((req, res) => {
  if (!req.headers.authorization || req.headers.authorization === 'null') {
    console.log('NOT LOGGED IN');
    return baseConfig;
  }
  return firebase.auth().verifyIdToken(req.headers.authorization)
  .then(decodedToken => {
    // Now we need to look up the employee ID
    const query = 'select EmpID from UserMap where Email = ' +
                  `'${decodedToken.email}' COLLATE SQL_Latin1_General_CP1_CI_AS`;
    return pool.request()
    .query(query)
    .then(res1 => {
      if (res1.recordset.length > 0) {
        return Promise.resolve(res1.recordset[0].EmpID);
      }
      throw new Error('Unable to find employee by email.');
    })
    .then(employeeId => {
      return pool.request()
      .query(`SELECT TOP(1) * FROM dbo.SuperUsers WHERE EmpID = ${employeeId}`)
      .then(res2 => {
        let superuser = false;
        if (res2.recordset.length === 1) {
          superuser = res2.recordset[0].IsSuperUser !== 0;
        }
        return {
          schema: executableSchema,
          context: {
            pool,
            employee_id: employeeId,
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
      console.log(`Error decoding authentication token: ${JSON.stringify(error)}`);
      throw new Error(`Error decoding authentication token: ${JSON.stringify(error)}`);
    }
    return baseConfig;
  });
}));

graphQLServer.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
}));

graphQLServer.listen(GRAPHQL_PORT, () => console.log(
  `GraphQL Server is now running on http://localhost:${GRAPHQL_PORT}/graphql`
));

