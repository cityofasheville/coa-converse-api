const sql = require('mssql');

const getReviewRecord = (id, context) => {
  const logger = context.logger;
  return context.pool.request()
  .input('rid', sql.Int, id)
  .query('SELECT * from Reviews WHERE R_ID = @rid')
  .then(revResult => {
    const r = revResult.recordset[0];
    const review = {
      id: r.R_ID,
      status: r.Status,
      status_date: new Date(r.Status_Date).toISOString(),
      periodStart: null, // Currently not in use.
      periodEnd: new Date(r.Period_End).toISOString(),
      reviewer_name: r.Reviewer,
      employee_name: r.Employee,
      employee_id: r.EmpID,
      supervisor_id: r.SupID,
    };
    return Promise.resolve(review);
  })
  .catch(err => {
    logger.error(`Error retrieving check-in record ${id}: ${err} for user ${context.email}`);
    throw new Error(`Error retrieving check-in record: ${err}`);
  });
};

module.exports = getReviewRecord;
