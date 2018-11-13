
const getReviewRecord = (id, context) => {
  const logger = context.logger;
  return context.pool
  .query('SELECT * from reviews.reviews WHERE review_id = $1', [id])
  .then(revResult => {
    const r = revResult.rows[0];
    const review = {
      id: r.review_id,
      status: r.status,
      status_date: new Date(r.status_date).toISOString(),
      periodStart: null, // Currently not in use.
      periodEnd: new Date(r.period_end).toISOString(),
      reviewer_name: null,
      employee_name: null,
      employee_id: r.employee_id,
      supervisor_id: r.supervisor_id,
    };
    return Promise.resolve(review);
  })
  .catch(err => {
    logger.error(`Error retrieving check-in record ${id}: ${err} for user ${context.email}`);
    throw new Error(`Error retrieving check-in record: ${err}`);
  });
};

module.exports = getReviewRecord;
