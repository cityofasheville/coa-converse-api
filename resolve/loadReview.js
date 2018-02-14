const MULTIRESPONSE = require('../constants').MULTIRESPONSE;
const loadReview = (r, review) => {
  let nreview;
  if (review.status === null) {
    nreview = {
      id: r.R_ID,
      status: r.Status,
      status_date: new Date(r.Status_Date).toISOString(),
      supervisor_id: r.EmpSupID,
      employee_id: r.EmpID,
      position: r.Position,
      periodStart: null, // Currently not in use
      periodEnd: new Date(r.Period_End).toISOString(),
      reviewer_name: r.Reviewer,
      employee_name: r.Employee,
      employee_email: r.EmpEmail,
      supervisor_email: r.ReviewerEmail,
      questions: [],
      responses: [],
    };
    if (!MULTIRESPONSE) {
      nreview.responses = [{ question_id: null, Response: r.Response }];
    }
  } else {
    nreview = Object.assign({}, review);
  }
  nreview.questions.push(
    {
      id: r.Q_ID,
      type: r.QT_Type,
      question: r.QT_Question,
      answer: r.Answer,
      required: r.Required,
    }
  );
  if (MULTIRESPONSE) {
    nreview.responses.push({
      question_id: r.Q_ID,
      Response: r.Response,
    });
  }
  return nreview;
};

module.exports = loadReview;
