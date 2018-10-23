const sql = require('mssql');

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

const getEmployee = (id, pool, logger) => {
  return pool.request()
    .input('UserEmpID', sql.Int, id)
    .execute('avp_Get_Employee')
    .then(result => {
      const e = result.recordset[0];
      const lastRev = (e.LastReviewed === null) ? null : new Date(e.LastReviewed).toISOString();
      return Promise.resolve({
        id,
        active: e.Active,
        ft_status: e.FT_Status,
        name: e.Employee,
        email: e.Emp_Email,
        position: e.Position,
        department: e.Department,
        division: e.Division,
        current_review: e.CurrentReview,
        last_reviewed: lastRev,
        reviewable: isReviewable(e),
        review_by: new Date(e.ReviewBy).toISOString(),
        not_reviewable_reason: notReviewableReason(e),
        supervisor_id: e.SupID,
        supervisor_name: e.Supervisor,
        supervisor_email: e.Sup_Email,
        employees: [],
        reviews: null,
      });
    })
    .catch(err => {
      logger.error(`Error getting employee ${err}`);
      return Promise.resolve({ error: `Error getting employee: ${err}` });
    });
};

module.exports = getEmployee;
