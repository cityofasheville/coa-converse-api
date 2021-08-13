const { getEmployee, getSubordinates } = require('./utilities/get_employee_info.js');
const operationIsAllowed = require('./utilities/operation_is_allowed');
const getDbConnection = require('../common/db')
const Logger = require('coa-node-logging')
const logFile = process.env.logfile ? process.env.logfile : null
const logger = new Logger('checkins-query', logFile)
const whPool = getDbConnection('reviews')
const employee = (obj, args) => {
  const pool = getDbConnection('mds');
  if (Object.prototype.hasOwnProperty.call(args, 'id')) {
    return operationIsAllowed(args.id, context)
    .then(isAllowed => {
      if (isAllowed) return getEmployee(args.id, pool, whPool, logger);
      throw new Error('Employee query not allowed');
    });
  } else if (context.email !== null) {
    if (context.employee_id !== null) {
      return getEmployee(context.employee_id, pool, whPool, logger);
    }
  }
  throw new Error('In employee query - employee_id not set');
};

const employees = (obj, args, context) => {
  const pool = context.pool;
  const whPool = whPool;
  const id = obj.id;
  return operationIsAllowed(id, context)
  .then(isAllowed => {
    if (isAllowed) {
      return getSubordinates(obj.id, pool, whPool, logger);
    }
    throw new Error('Employees query not allowed');
  });
};

module.exports = {
  employee,
  employees,
};
