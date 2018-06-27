const sql = require('mssql');

const operationIsAllowed = (targetId, context) => {
  const pool = context.pool;
  const myId = context.employee.employee_id;
  let isAllowed = false;
  if (context.superuser || myId === targetId) {
    return Promise.resolve(true);
  }
  return pool.request()
  .input('UserEmpID', sql.Int, myId)
  .input('EmpID', sql.Int, targetId)
  .output('May_View', sql.NChar(1)) // eslint-disable-line new-cap
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

module.exports = operationIsAllowed;
