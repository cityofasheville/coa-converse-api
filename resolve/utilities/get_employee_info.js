const { isReviewable, notReviewableReason } = require('./reviewable');

const getEmployee = (id, pool, whPool, logger) => {
  console.log('I am in getEmployee');
  return whPool.query('select * from internal.employees_main_view where emp_id = $1', [id])
    .then(result => {
      const e = result.rows[0];
      // const lastRev = (e.LastReviewed === null) ? null : new Date(e.LastReviewed).toISOString();
      return Promise.resolve({
        id,
        active: e.active,
        ft_status: e.ft_status,
        name: e.employee,
        email: e.emp_email,
        position: e.position,
        department: e.department,
        department_id: e.dept_id,
        division: e.division,
        division_id: e.div_id,
        current_review: null, // CurrentReview
        last_reviewed: null, // Last reviewed
        reviewable: isReviewable(e),
        review_by: null, // new Date(e.ReviewBy).toISOString(),
        not_reviewable_reason: notReviewableReason(e),
        supervisor_id: e.sup_id,
        supervisor_name: e.supervisor,
        supervisor_email: e.sup_email,
        employees: [],
        reviews: null,
      });
    })
    .then(employee => {
      const employeesReviewStatusQuery = `
        SELECT employee_id,
        MAX( CASE WHEN status = 'Closed' THEN status_date ELSE null END) as last_reviewed,
        MAX( CASE WHEN status <> 'Closed' THEN review_id ELSE null END) as current_review
        FROM reviews.reviews 
        WHERE employee_id = $1 GROUP BY employee_id
        `;
      return pool.query(employeesReviewStatusQuery, [id])
      .then(res => {
        const r = res.rows[0];
        const augEmployee = Object.assign({}, employee, {
          current_review: r.current_review,
          last_reviewed: (r.last_reviewed === null) ? null : new Date(r.last_reviewed).toISOString(),
        });
        return augEmployee;
      });
    })
    .catch(err => {
      logger.error(`Error getting employee ${err}`);
      return Promise.resolve({ error: `Error getting employee: ${err}` });
    });
};

module.exports = getEmployee;
