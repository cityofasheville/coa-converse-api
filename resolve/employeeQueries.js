const sql = require('mssql');
const getEmployee = require('./getEmployee.js');
const operationIsAllowed = require('./operationIsAllowed');

const employee = (obj, args, context) => {
  const pool = context.pool;
  if (args.hasOwnProperty('id')) {
    return operationIsAllowed(args.id, context)
    .then(isAllowed => {
      if (isAllowed) {
        return getEmployee(args.id, pool, context.logger);
      }
      throw new Error('Employee query not allowed');
    });
  } else if (context.email !== null) {
    if (context.employee_id !== null) {
      return getEmployee(context.employee_id, pool, context.logger);
    }
  }
  throw new Error('In employee query - employee_id not set');
};

const reviewableTypes = ['CA', 'FT', 'IN', 'PB', 'PN'];
const isReviewable = (e) => {
  // return (
  //   e.Active === 'A' && e.Position !== null && e.Position !== '' &&
  //   e.Emp_Email !== null && e.Emp_Email !== ''
  // );
  return (
    e.Active === 'A' &&
    e.Emp_Email !== null && e.Emp_Email !== '' &&
    reviewableTypes.includes(e.FT_Status)
  );
};

const notReviewableReason = (e) => {
  let reason = null;
  if (!isReviewable(e)) {
    if (e.Active !== 'A') reason = 'Inactive';
    else if (!reviewableTypes.includes(e.FT_Status)) reason = 'Non-included employee type';
    else if (e.Position === null || e.Position === '') reason = 'No position';
    else reason = 'Employee not registered for Employee Check-in';
  }
  return reason;
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
        result.recordset.filter(e => {
          return e.Active === 'A';
        }).forEach(e => {
          const lastRev = (e.LastReviewed === null) ? null : new Date(e.LastReviewed).toISOString();
          const emp = {
            id: e.EmpID,
            active: e.Active,
            ft_status: e.FT_Status,
            name: e.Employee,
            email: e.Emp_Email,
            position: e.Position,
            department: e.Department,
            division: e.Division,
            last_reviewed: lastRev,
            review_by: new Date(e.ReviewBy).toISOString(),
            reviewable: isReviewable(e),
            not_reviewable_reason: notReviewableReason(e),
            supervisor_id: e.SupID,
            supervisor_name: e.Supervisor,
            supervisor_email: e.Sup_Email,
            employees: null,
            reviews: null,
          };
          myEmployees.push(emp);
        });
        return Promise.resolve(myEmployees);
      });
    }
    throw new Error('Employees query not allowed');
  });
};

module.exports = {
  employee,
  employees,
};
