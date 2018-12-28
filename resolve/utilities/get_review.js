
const loadBaseReview = (r) => {
  return {
    id: r.review_id,
    status: r.status,
    status_date: r.status_date,
    employee_id: r.employee_id,
    supervisor_id: r.supervisor_id,
    position: r.position,
    periodStart: r.period_start === null ? null : r.period_start.toISOString(),
    periodEnd: r.period_end.toISOString(),
    previousReviewDate: null,
    employee_name: null,
    employee_email: null,
    reviewer_name: null,
    reviewer_email: null,
    questions: [],
    responses: [],
  };
};

const getReview = (reviewId, context) => {
  const pool = context.pool;
  const whPool = context.whPool;
  const cQuery = 'SELECT * FROM reviews.reviews WHERE review_id = $1 ';
  return pool.query(cQuery, [reviewId])
  .then(res => {
    const r = res.rows[0];
    const lastRevQuery = `
      SELECT MAX(period_end) AS previous_date
        FROM reviews.reviews
        WHERE employee_id = ${r.employee_id} AND period_end < '${r.period_end.toISOString()}'
    `;
    return pool.query(lastRevQuery)
    .then((lRes) => {
      let previousReviewDate = null;
      if (lRes.rows[0].previous_date !== null) {
        previousReviewDate = lRes.rows[0].previous_date.toISOString();
      }
      const review = loadBaseReview(r);
      review.previousReviewDate = previousReviewDate;

      const eQuery = 'select emp_id, employee, emp_email from internal.pr_employee_info where emp_id = ANY($1)';
      return whPool.query(eQuery, [[review.employee_id, review.supervisor_id]])
      .then((eList) => {
        eList.rows.forEach((itm) => {
          if (itm.emp_id === review.employee_id) {
            review.employee_name = itm.employee;
            review.employee_email = itm.emp_email;
          } else if (itm.emp_id === review.supervisor_id) {
            review.reviewer_name = itm.employee;
            review.reviewer_email = itm.emp_email;
          }
        });
        const qQuery = `SELECT
            Q.question_id, Q.qt_type, q.qt_question, Q.answer, Q.required,
            R.response
          FROM reviews.questions AS Q LEFT OUTER JOIN
          reviews.responses AS R ON R.question_id = Q.question_id
          WHERE Q.review_id = ${review.id}
          ORDER BY Q.qt_order ASC
        `;
        return pool.query(qQuery)
        .then((qres) => {
          qres.rows.forEach((qr) => {
            review.questions.push({
              id: qr.question_id,
              type: qr.qt_type,
              question: qr.qt_question,
              answer: qr.answer,
              require: qr.required,
            });
            review.responses.push({
              question_id: qr.question_id,
              review_id: review.id,
              Response: qr.response,
            });
          });
          return Promise.resolve(review);
        });
      });
    });
  })
  .catch(err => {
    console.log(`ERROR: ${err}`);
  });
};

const getReviews = (id, context) => {
  const pool = context.pool;
  return pool.query('SELECT * from reviews.reviews where employee_id = $1', [id])
  .then(result => {
    const revs = result.rows;
    const eMap = {};
    eMap[id] = {};
    revs.forEach(r => { eMap[r.supervisor_id] = {}; });
    const query = 'select emp_id, employee from internal.pr_employee_info where emp_id = ANY($1)';
    return context.whPool.query(query, [Object.keys(eMap)])
    .then(employees => {
      employees.rows.forEach(e => { eMap[e.emp_id] = e; });
      return revs.map(r => {
        const rev = loadBaseReview(r);
        rev.reviewer_name = eMap[r.supervisor_id].employee;
        rev.employee_name = eMap[id].employee;
        return rev;
      });
    });
  });
};

module.exports = {
  getReview,
  getReviews,
};
