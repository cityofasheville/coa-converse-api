const express = require('express');
const { apolloExpress, graphiqlExpress } = require('apollo-server');
const { makeExecutableSchema } = require('graphql-tools');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();


console.log('Build the schema');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const executableSchema = makeExecutableSchema({
  typeDefs,
  resolvers,
});
console.log('Done');
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
  console.log(`Got ourselves a damn error: ${err}`);
});

console.log('Here we go');
pool.connect(err => {
  if (err) console.log(`Error trying to create a connection pool ${err}`);
});


const GRAPHQL_PORT = process.env.PORT || 8080;
console.log(`The graphql port is ${GRAPHQL_PORT}`);
const graphQLServer = express().use('*', cors());

graphQLServer.use('/graphql', bodyParser.json(), apolloExpress((req, res) => {
  if (!req.headers.authorization || req.headers.authorization === 'null') {
    console.log('NOT LOGGED IN');
    return {
      schema: executableSchema,
      context: {
        pool,
        employee_id: '1316',
        loggedin: false,
        token: null,
        uid: null,
        name: null,
        email: null,
        groups: [],
        subscriptions: null,
      },
    };
  }
  return firebase.auth().verifyIdToken(req.headers.authorization).then((decodedToken) => {
    console.log('auth-verify');
    // Now we need to look up the employee ID
    const query = `select EmpID from UserMap where Email = '${context.email}'`;
    return pool.request()
    .query(query)
    .then(result => {
      console.log(result);
      if (result.recordset.length > 0) {
        return {
          schema: executableSchema,
          context: {
            pool,
            employee_id: result.recordset[0].EmpID,
            loggedin: true,
            token: req.headers.authorization,
            uid: decodedToken.uid,
            name: decodedToken.name,
            email: decodedToken.email,
          },
        };
      }
      return null;
    });
  }).catch((error) => {
    if (req.headers.authorization !== 'null') {
      console.log(`Error decoding authentication token: ${JSON.stringify(error)}`);
    }
    return {
      schema: executableSchema,
      context: {
        pool,
        employee_id: '1316',
        loggedin: false,
        token: null,
        uid: null,
        name: null,
        email: null,
        groups: [],
        subscriptions: null,
      },
    };
  });
}));

graphQLServer.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
}));

graphQLServer.listen(GRAPHQL_PORT, () => console.log(
  `GraphQL Server is now running on http://localhost:${GRAPHQL_PORT}/graphql`
));

// Killing the subscription server for now.
/*
// WebSocket server for subscriptions
const websocketServer = createServer((request, response) => {
  response.writeHead(404);
  response.end();
});

websocketServer.listen(WS_PORT, () => console.log( // eslint-disable-line no-console
  `Websocket Server is now running on http://localhost:${WS_PORT}`
));


// eslint-disable-next-line
new SubscriptionServer(
  { subscriptionManager },
  websocketServer
);
*/
