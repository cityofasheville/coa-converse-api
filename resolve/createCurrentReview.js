const sql = require('mssql');
const getFullReview = require('./getFullReview');
const loadReview = require('./loadReview');

const createCurrentReview = (emp, pool, logger) => {
  const t1 = new Date();
  const t1s = `${t1.getFullYear()}-${t1.getMonth() + 1}-${t1.getDate()}`;

  return pool.request()
  .input('EmpID', sql.Int, emp.id)
  .input('SupID', sql.Int, emp.supervisor_id)
  .input('RT_ID', sql.Int, 3) // Last parameter is Review ID to pick questions
  .input('PeriodStart', sql.Date, null) // Currently not in use
  .input('PeriodEnd', sql.Date, t1s)
  .output('R_ID', sql.Int)
  .execute('avp_New_Review')
  .then(result => {
    const currentReviewId = result.output.R_ID;
    return getFullReview(currentReviewId, pool, logger);
  })
  .catch(err => {
    logger.error(`Error creating new check-in in createCurrentReview: ${err}`);
    throw new Error(`Error creating new check-in: ${err}`);
  });
};

module.exports = createCurrentReview;
