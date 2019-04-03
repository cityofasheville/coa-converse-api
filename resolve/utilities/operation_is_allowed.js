const isOperationAllowed = (targetId, context) => {
  const myId = context.employee_id;
  if (myId === undefined) return Promise.resolve(false);
  if (context.superuser || myId === targetId) {
    return Promise.resolve(true);
  }
  const query = `
    select case WHEN count(emp_id) = 1 then true else false end as allowed from (
      select distinct emp_id, employee, sup_id from (
        WITH RECURSIVE subordinates AS (
          SELECT emp_id, employee, sup_id, 0 depth
          FROM internal.pr_employee_info
          WHERE emp_id = $1
          UNION
          SELECT
          e.emp_id, e.employee, e.sup_id, s.depth + 1 depth
          FROM internal.pr_employee_info e
          INNER JOIN subordinates s ON s.emp_id = e.sup_id
          WHERE depth < 10
        ) SELECT * FROM subordinates
      ) AS A where emp_id = $2
    ) AS B
  `;
  return context.whPool.query(query, [myId, targetId])
    .then((result) => {
      if (result.rows && result.rows.length > 0 && result.rows[0].allowed) {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    });
};

module.exports = isOperationAllowed;


// const operationIsAllowed = (targetId, context) => {
//   const pool = context.pool;
//   const myId = context.employee_id;
//   let isAllowed = false;
//   if (context.superuser || myId === targetId) {
//     return Promise.resolve(true);
//   }
//   return pool.request()
//   .input('UserEmpID', sql.Int, myId)
//   .input('EmpID', sql.Int, targetId)
//   .output('May_View', sql.NChar(1)) // eslint-disable-line new-cap
//   .execute('avp_May_View_Emp')
//   .then(result => {
//     if (result.output.hasOwnProperty('May_View')) {
//       if (result.output.May_View === 'Y') {
//         isAllowed = true;
//       }
//     }
//     return Promise.resolve(isAllowed);
//   });
// };

// module.exports = operationIsAllowed;
