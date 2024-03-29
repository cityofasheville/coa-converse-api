/* **************************************************************************************
  WARNING: DO NOT EDIT this file except from inside the graphql-starter-template repository.
  Changes made to this file inside child repos will NOT be reflected in the parent source
  template repository, and will interfere with the ability to upgrade common code from
  the template repository.
***************************************************************************************** */
//const apiConfigs = require('../api/db_configs');

const defaultConfigs = {
  mds: {
    db_type: 'pg',
    host: process.env.mds_host,
    user: process.env.mds_user,
    password: process.env.mds_password,
    database: process.env.mds_database,
    port: 5432,
    ssl: false,
  },
  reviews: {
    db_type: 'pg',
    host: process.env.reviews_host,
    user: process.env.reviews_user,
    password: process.env.reviews_password,
    database: process.env.reviews_database,
    port: 5432,
    ssl: false,
  },
};



/*
 * Sample MSSQL configuration:
 *
 * const msconfig = {
 *    user: process.env.dbuser,
 *    password: process.env.dbpassword,
 *    server: process.env.dbhost,
 *    database: process.env.database,
 *    pool: {
 *      max: 10,
 *      min: 0,
 *      idleTimeoutMillis: 30000,
 *    },
 * };
 */

module.exports = Object.assign({}, defaultConfigs);
