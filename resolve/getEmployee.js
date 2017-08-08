const sql = require('mssql');

const getEmployee = (id, pool) => {
  return pool.request()
    .input('UserEmpID', sql.Int, id)
    .execute('avp_Get_Employee')
    .then(result => {
      const e = result.recordset[0];
      const lastRev = (e.LastReviewed === null) ? null : new Date(e.LastReviewed).toISOString();
      return Promise.resolve({
        id,
        active: e.Active,
        name: e.Employee,
        email: e.Emp_Email,
        position: e.Position,
        department: e.Department,
        division: e.Division,
        current_review: e.CurrentReview,
        last_reviewed: lastRev,
        reviewable: e.Active && e.Position !== null && e.Position !== '',
        review_by: new Date(e.ReviewBy).toISOString(),
        supervisor_id: e.SupID,
        supervisor_name: e.Supervisor,
        supervisor_email: e.Sup_Email,
        employees: [],
        reviews: null,
      });
    })
    .catch(err => {
      return Promise.resolve({ error: `Error getting employee: ${err}` });
    });
};

module.exports = getEmployee;
