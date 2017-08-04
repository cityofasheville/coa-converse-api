const sql = require('mssql');

const getReview = (id, context) => {
  return context.pool.request()
  .input('rid', sql.Int, id)
  .query('SELECT * from Reviews WHERE R_ID = @rid')
  .then(revResult => {
    const r = revResult.recordset[0];
    const review = {
      id: r.R_ID,
      status: r.Status,
      status_date: new Date(r.Status_Date).toISOString(),
      periodStart: new Date(r.Period_Start).toISOString(),
      periodEnd: new Date(r.Period_End).toISOString(),
      reviewer_name: r.Reviewer,
    };
    return Promise.resolve(review);
  })
  .catch(err => {
    throw new Error(`Error retrieving conversation: ${err}`);
  });
};

module.exports = getReview;
