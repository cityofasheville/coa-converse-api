const sql = require('mssql');
const loadReview = require('./loadReview');

const getFullReview = (reviewId, pool, logger) => {
  let review = {
    status: null,
  };
  return pool.request()
  .input('ReviewID', sql.Int, reviewId)
  .execute('avp_get_review')
  .then((result) => {
    result.recordset.forEach(r => {
      review = loadReview(r, review);
    });
    // Now we have the review, get last review date.
    const query = 'SELECT MAX(Period_End) as previousReviewDate '
    + `FROM Reviews WHERE EmpID = ${review.employee_id} `
    + `AND Period_End < '${review.periodEnd}'`;
    return pool.request().query(query)
    .then(dmax => {
      if (dmax.recordset.length > 0) {
        review.previousReviewDate = new Date(dmax.recordset[0].previousReviewDate).toISOString();
        // review.previousReviewDate = dmax.recordset[0].previousReviewDate;
      }
      return review;
    });
  })
  .catch(err => {
    console.log(`ERROR: ${err}`);
  });
};

module.exports = getFullReview;
