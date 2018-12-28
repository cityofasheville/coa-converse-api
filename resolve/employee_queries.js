const { getEmployee, getSubordinates } = require('./utilities/get_employee_info.js');
const operationIsAllowed = require('./utilities/operation_is_allowed');

const employee = (obj, args, context) => {
  const pool = context.pool;
  if (Object.prototype.hasOwnProperty.call(args, 'id')) {
    return operationIsAllowed(args.id, context)
    .then(isAllowed => {
      if (isAllowed) return getEmployee(args.id, pool, context.whPool, context.logger);
      throw new Error('Employee query not allowed');
    });
  } else if (context.email !== null) {
    if (context.employee_id !== null) {
      return getEmployee(context.employee_id, pool, context.whPool, context.logger);
    }
  }
  throw new Error('In employee query - employee_id not set');
};

const employees = (obj, args, context) => {
  const pool = context.pool;
  const whPool = context.whPool;
  const id = obj.id;
  return operationIsAllowed(id, context)
  .then(isAllowed => {
    if (isAllowed) {
      return getSubordinates(obj.id, pool, whPool, context.logger);
    }
    throw new Error('Employees query not allowed');
  });
};

module.exports = {
  employee,
  employees,
};
