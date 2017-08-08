const sql = require('mssql');
const getEmployee = require('./getEmployee.js');
const operationIsAllowed = require('./operationIsAllowed');

const employee = (obj, args, context) => {
  const pool = context.pool;
  if (args.hasOwnProperty('id')) {
    return operationIsAllowed(args.id, context)
    .then(isAllowed => {
      if (isAllowed) {
        return getEmployee(args.id, pool);
      }
      throw new Error('Employee query not allowed');
    });
  } else if (context.email !== null) {
    if (context.employee_id !== null) {
      return getEmployee(context.employee_id, pool);
    }
  }
  throw new Error('In employee query - employee_id not set');
};

const employees = (obj, args, context) => {
  const pool = context.pool;
  const id = obj.id;// AUTH HERE before doing the rest of the query.
  const myEmployees = [];
  return operationIsAllowed(id, context)
  .then(isAllowed => {
    if (isAllowed) {
      return pool.request()
      .input('UserEmpID', sql.Int, id)
      .execute('avp_Get_My_Employees')
      .then(result => {
        result.recordset.forEach(e => {
          const lastRev = (e.LastReviewed === null) ? null : new Date(e.LastReviewed).toISOString();
          const emp = {
            id: e.EmpID,
            active: e.Active,
            name: e.Employee,
            email: e.Emp_Email,
            position: e.Position,
            department: e.Department,
            division: e.Division,
            last_reviewed: lastRev,
            review_by: new Date(e.ReviewBy).toISOString(),
            reviewable: e.Active && e.Position !== null && e.Position !== '',
            supervisor_id: e.SupID,
            supervisor_name: e.Supervisor,
            supervisor_email: e.Sup_Email,
            employees: null,
            reviews: null,
          };
          myEmployees.push(emp);
        });
        return myEmployees;
      });
    }
    throw new Error('Employees query not allowed');
  });
};

module.exports = {
  employee,
  employees,
};
