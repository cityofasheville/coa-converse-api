const reviewableTypes = ['CA', 'FT', 'IN', 'PB', 'PN'];
const isReviewable = (e) => {
  // return (
  //   e.Active === 'A' && e.Position !== null && e.Position !== '' &&
  //   e.Emp_Email !== null && e.Emp_Email !== ''
  // );
  return (
    e.active === 'A' &&
    e.emp_email !== null && e.emp_email !== '' &&
    reviewableTypes.includes(e.ft_status)
  );
};

const notReviewableReason = (e) => {
  let reason = null;
  if (!isReviewable(e)) {
    if (e.active !== 'A') reason = 'Inactive';
    else if (!reviewableTypes.includes(e.ft_status)) reason = 'Non-included employee type';
    else if (e.position === null || e.position === '') reason = 'No position';
    else reason = 'Employee not registered for Employee Check-in';
  }
  return reason;
};

const getEmployee = (id, pool, whPool, logger) => {
  console.log('I am in getEmployee');
  // return pool.request()
  //   .input('UserEmpID', sql.Int, id)
  //   .execute('avp_Get_Employee')
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
        division: e.division,
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
