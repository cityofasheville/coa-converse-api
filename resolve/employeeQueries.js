const getEmployee = require('./getEmployee.js');
const operationIsAllowed = require('./operationIsAllowed');

const employee = (obj, args, context) => {
  const pool = context.pool;
  if (args.hasOwnProperty('id')) {
    return operationIsAllowed(args.id, context)
    .then(isAllowed => {
      if (isAllowed) {
        return getEmployee(args.id, pool, context.whPool, context.logger);
      }
      throw new Error('Employee query not allowed');
    });
  } else if (context.email !== null) {
    if (context.employee_id !== null) {
      return getEmployee(context.employee_id, pool, context.whPool, context.logger);
    }
  }
  throw new Error('In employee query - employee_id not set');
};

const reviewableTypes = ['CA', 'FT', 'IN', 'PB', 'PN'];
const isReviewable = (e) => {
  return (
    e.active === 'A' &&
    e.emp_email !== null && e.emp_email !== '' &&
    reviewableTypes.includes(e.ft_status)
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
  console.log('In employees');
  const pool = context.pool;
  const whPool = context.whPool;
  const id = obj.id;// AUTH HERE before doing the rest of the query.
  const employeesById = {};
  return operationIsAllowed(id, context)
  .then(isAllowed => {
    if (isAllowed) {
      const eIds = [];
      // return pool.request()
      // .input('UserEmpID', sql.Int, id)
      // .execute('avp_Get_My_Employees')
      return whPool.query('select * from internal.employees_main_view where sup_id = $1', [id])
      .then(result => {
        result.rows.filter(e => {
          return e.active === 'A';
        }).forEach(e => {
          eIds.push(e.emp_id);
          const emp = {
            id: e.emp_id,
            active: e.active,
            ft_status: e.ft_status,
            name: e.employee,
            email: e.emp_email,
            position: e.position,
            department: e.department,
            division: e.division,
            current_review: null,
            last_reviewed: null,
            reviewable: isReviewable(e),
            review_by: null,
            not_reviewable_reason: notReviewableReason(e),
            supervisor_id: e.sup_id,
            supervisor_name: e.supervisor,
            supervisor_email: e.sup_email,
            employees: null,
            reviews: null,
          };
          employeesById[e.emp_id] = emp;
        });
        const employeesReviewStatusQuery = `
        SELECT employee_id,
        MAX( CASE WHEN status = 'Closed' THEN status_date ELSE null END) as last_reviewed,
        MAX( CASE WHEN status <> 'Closed' THEN review_id ELSE null END) as current_review
        FROM reviews.reviews 
        WHERE employee_id = ANY($1) GROUP BY employee_id
        `;
        return pool.query(employeesReviewStatusQuery, [eIds])
        .then(res => {
          console.log(JSON.stringify(res.rows));
          return res.rows.map(r => {
            const e = employeesById[r.employee_id];
            e.current_review = r.current_review;
            e.last_reviewed = (r.last_reviewed === null) ? null : new Date(r.last_reviewed).toISOString();
            return e;
          });
        });
      });
    }
    throw new Error('Employees query not allowed');
  });
};

module.exports = {
  employee,
  employees,
};
