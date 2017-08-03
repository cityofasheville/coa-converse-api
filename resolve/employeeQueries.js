const sql = require('mssql');
const getEmployee = require('./getEmployee.js');

const operationIsAllowed = (targetId, context) => {
  const pool = context.pool;
  const myId = context.employee_id;
  let isAllowed = false;
  if (context.superuser) return Promise.resolve(true);
  return pool.request()
  .input('UserEmpID', sql.Int, myId)
  .input('EmpID', sql.Int, targetId)
  .output('May_View', sql.NChar(1))
  .execute('avp_May_View_Emp')
  .then(result => {
    if (result.output.hasOwnProperty('May_View')) {
      if (result.output.May_View === 'Y') {
        isAllowed = true;
      }
    }
    return Promise.resolve(isAllowed);
  });
};

const employee = (obj, args, context) => {
  const pool = context.pool;
  if (args.hasOwnProperty('id')) {
    return operationIsAllowed(args.id, context)
    .then(isAllowed => {
      if (isAllowed) {
        console.log('Operation is allowed');
        return getEmployee(args.id, pool);
      } else {
        console.log('Operation is not allowed');
        throw new Error('Employee query not allowed');
      }
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
  return pool.request()
    .input('UserEmpID', sql.Int, id)
    .execute('avp_Get_My_Employees')
    .then(result => {
      result.recordset.forEach(e => {
        const emp = {
          id: e.EmpID,
          active: e.Active,
          name: e.Employee,
          email: e.Emp_Email,
          position: e.Position,
          department: e.Department,
          division: e.Division,
          last_reviewed: new Date(e.LastReviewed).toISOString(),
          review_by: new Date(e.ReviewBy).toISOString(),
          reviewable: e.Active && e.Position !== null && e.Position !== '',
          supervisor_id: e.SupID,
          supervisor_name: e.Supervisor,
          supervisor_email: e.Sup_Email,
          employees: null,
          reviews: null,
        };
        console.log(`  Employee: ${emp.name}`);
        myEmployees.push(emp);
      });
      return myEmployees;
    });
};

module.exports = {
  employee,
  employees,
};
