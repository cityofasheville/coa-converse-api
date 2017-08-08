const sql = require('mssql');
const loadReview = require('./loadReview');

const createCurrentReview = (emp, pool) => {
  const t1 = new Date();
//  const t1s = `${t1.getFullYear()}-${t1.getMonth() + 1}-${t1.getDate()}`;
  const t2 = new Date(t1);
  t2.setDate(t1.getDate());
  const t2s = `${t2.getFullYear()}-${t2.getMonth() + 1}-${t2.getDate()}`;

  return pool.request()
  .input('EmpID', sql.Int, emp.id)
  .input('SupID', sql.Int, emp.supervisor_id)
  .input('RT_ID', sql.Int, 2)
//  .input('PeriodStart', sql.Date, t1s)
  .input('PeriodStart', sql.Date, emp.last_reviewed)
  .input('PeriodEnd', sql.Date, t2s)
  .output('R_ID', sql.Int)
  .execute('avp_New_Review')
  .then(result => {
    const currentReviewId = result.output.R_ID;
    return pool.request()
      .input('ReviewID', sql.Int, currentReviewId)
      .execute('avp_get_review')
      .then((result2) => {
        let rev = {
          status: null,
        };
        result2.recordset.forEach(r => {
          rev = loadReview(r, rev);
        });
        return rev;
      })
      .catch(err => {
        throw new Error(`Error doing review query: ${err}`);
      });
  })
  .catch(err => {
    throw new Error(`ERROR CALLING NEW REVIEW: ${err}`);
  });
};

module.exports = createCurrentReview;
