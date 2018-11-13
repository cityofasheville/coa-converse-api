const getFullReview = require('./getFullReview');

const createCurrentReview = (emp, context) => {
  const conn = context.pool;
  const templateId = 3;
  const t1 = new Date();
  const t1s = `${t1.getFullYear()}-${t1.getMonth() + 1}-${t1.getDate()}`;
  console.log(`Hi there, ${t1s} and ${typeof context.pool}`);
  const cInsert = `
    INSERT INTO reviews.reviews
      (template_id, template_name, template_desc, status, status_date, supervisor_id, 
      employee_id, division_id, position, period_start, period_end)
    SELECT template_id, name, description, 'Open', '${t1s}', ${emp.supervisor_id}, ${emp.id},
           '${emp.division_id}', '${emp.position}', null, '${t1s}'
    FROM reviews.review_templates WHERE template_id = ${templateId};
    SELECT currval('reviews.reviews_id_seq') AS review_id;
  `;
  console.log(cInsert);
  return conn.query(cInsert)
    .then((results) => {
      console.log(JSON.stringify(results));
      const reviewId = results.rows[0].review_id;
      const qInsert = `
        INSERT INTO reviews.questions
          (template_id, review_id, question_template_id, qt_order, qt_type, qt_question, required)
        SELECT ${templateId}, ${reviewId},
              question_template_id, question_order, question_type, question_text, required
        FROM reviews.question_templates
        WHERE review_template_id = ${templateId};
      `;
      return conn.query(qInsert)
        .then(() => {
          const rInsert = `
            INSERT INTO reviews.responses
              (review_id, question_id)
            SELECT ${reviewId}, question_id
            FROM reviews.questions
            WHERE review_id = ${reviewId}
          `;
          return conn.query(rInsert)
            .then(() => getFullReview(reviewId, context));
        });
    })
    .catch((error) => {
      console.log(error); // eslint-disable-line no-console
      throw new Error(`Error creating new checkin: ${error}`);
    });
};

module.exports = createCurrentReview;
