const sql = require('mssql');
const getReview = require('./getReview');
const loadReview = require('./loadReview');

const updateReview = (root, args, context) => {
  const rId = args.id;
  const inRev = args.review;
  let seq = Promise.resolve({ error: false });
  let newStatus = null;
  seq = getReview(rId, context)
  .then(review => {
    let status = review.status;
//    let periodStart = review.periodStart;
    let periodEnd = review.periodEnd;
    let doSave = false;

    if (context.employee_id !== review.employee_id &&
        context.employee_id !== review.supervisor_id) {
      throw new Error('Only the supervisor or employee can modify a check-in');
    }
    if (inRev.hasOwnProperty('status')) {
      newStatus = inRev.status;
      if (review.status !== newStatus) {
        doSave = true;
        let errorString = null;
        if (!(newStatus === 'Open' || newStatus === 'Ready' ||
              newStatus === 'Acknowledged' || newStatus === 'Closed')) {
          return Promise.resolve({ error: true, errorString: `Invalid status ${newStatus}` });
        }
        if (status === 'Open') {
          if (newStatus !== 'Ready') {
            errorString = `Invalid status transition from ${status} to ${newStatus}`;
          }
          if (context.employee_id !== review.supervisor_id) {
            errorString = 'Only supervisor may modify check-in in Open status';
          }
        } else if (status === 'Ready') {
          if (newStatus !== 'Open' && newStatus !== 'Acknowledged') {
            errorString = `Invalid status transition from ${status} to ${newStatus}`;
          }
          if (context.employee_id !== review.employee_id) {
            errorString = 'Only employee may modify check-in in Ready status';
          }
        } else if (status === 'Acknowledged') {
          if (newStatus !== 'Open' && newStatus !== 'Closed') {
            errorString = `Invalid status transition from ${status} to ${newStatus}`;
          }
          if (context.employee_id !== review.supervisor_id) {
            errorString = 'Only supervisor may modify check-in in Acknowledged status';
          }
        } else if (status === 'Closed') {
          errorString = 'Status transition from Closed status is not allowed';
        }
        if (errorString !== null) {
          return Promise.resolve({ error: true, errorString });
        }
        status = newStatus;
        if (errorString !== null) {
          throw new Error(errorString);
        }
      }
    }

    // 8/8/17: We no longer allow periodStart to be updated via mutation.
    /*
      if (inRev.hasOwnProperty('periodStart')) {
        // Need to validate
        doSave = true;
        periodStart = inRev.periodStart;
      }
    */
    if (inRev.hasOwnProperty('periodEnd')) {
      // Need to validate
      doSave = true;
      periodEnd = inRev.periodEnd;
    }
    if (!doSave) return Promise.resolve({ error: false });

    const updQuery = 'UPDATE Reviews SET Status = @status, Period_Start = @start, ' +
                     'Period_End = @end WHERE R_ID = @rid';
    return context.pool.request()
      .input('rid', sql.Int, rId)
      .input('status', sql.NVarChar, status)
      .input('start', sql.Date, inRev.periodStart)
      .input('end', sql.Date, periodEnd)
      .query(updQuery);
  })
  .then(revRes => {
    if (revRes.error) return Promise.resolve(revRes);
    if (revRes.rowsAffected === null || revRes.rowsAffected[0] !== 1) {
      return Promise.resolve({ error: true, errorString: 'Error updating period' });
    }
    return Promise.resolve({ error: false });
  })
  .catch(revErr => {
    throw new Error(`Error updating check-in: ${revErr}`);
  });
  return seq.then(res1 => { // Deal with the questions
    if (!res1.error && inRev.questions !== null && inRev.questions.length > 0) {
      const updateQuestions = inRev.questions.map(q => {
        const qId = q.id;
        const answer = (q.answer !== null) ? q.answer : '';
        return context.pool.request()
        .input('answer', sql.NVarChar, answer)
        .input('qid', sql.Int, qId)
        .query('UPDATE Questions SET Answer = @answer WHERE Q_ID = @qid')
        .then(qRes => {
          if (qRes.rowsAffected === null || qRes.rowsAffected[0] !== 1) {
            throw new Error(`Error updating question ${qId}`);
          }
          return Promise.resolve({ error: false });
        });
      });
      return Promise.all(updateQuestions);
    }
    return Promise.resolve(res1);
  })
  .then(res2 => { // Deal with response
    if (!res2.error && inRev.responses !== null && inRev.responses.length > 0) {
      const updateResponses = inRev.responses.map(r => {
        if (r.question_id === null) {
          return context.pool.request()
          .input('response', sql.NVarChar, r.Response)
          .input('rid', sql.Int, rId)
          .query('UPDATE Responses SET Response = @response WHERE R_ID = @rid');
        }
        return context.pool.request()
        .input('response', sql.NVarChar, r.Response)
        .input('rid', sql.Int, rId)
        .input('qid', sql.Int, r.question_id)
        .query('UPDATE Responses SET Response = @response WHERE (R_ID = @rid AND Q_ID = @qid)');
      });
      return Promise.all(updateResponses);
      // let req = context.pool.request();
      // let qId = null;
      // if (inRev.responses[0].hasOwnProperty('question_id')) {
      //   qId = inRev.responses[0].question_id;
      // }
      // if (qId === null) {
      //   req = req
      //   .input('response', sql.NVarChar, inRev.responses[0].Response)
      //   .input('rid', sql.Int, rId)
      //   .query('UPDATE Responses SET Response = @response WHERE R_ID = @rid');
      // } else {
      //   req = req
      //   .input('response', sql.NVarChar, inRev.responses[0].Response)
      //   .input('rid', sql.Int, rId)
      //   .input('qid', sql.Int, qId)
      //   .query('UPDATE Responses SET Response = @response WHERE (R_ID = @rid AND Q_ID = @qid)');
      // }
      // return req
      // .then(respRes => {
      //   if (respRes.rowsAffected === null || respRes.rowsAffected[0] !== 1) {
      //     throw new Error('Error updating response');
      //   }
      //   return Promise.resolve({ error: false });
      // });
    }
    return Promise.resolve(res2);
  })
  .then(res3 => { // All done - either error or return the updated review
    if (res3.error) {
      return Promise.resolve(res3);
    }
    return context.pool.request()
      .input('ReviewID', sql.Int, args.id)
      .execute('avp_get_review')
      .then((result) => {
        let review = {
          status: null,
        };
        result.recordset.forEach(r => {
          review = loadReview(r, review);
        });
        return Promise.resolve(review);
      })
      .catch(err => {
        throw new Error(`Error doing check-in query: ${err}`);
      });
  })
  .catch(err => {
    throw new Error(`Error at check-in update end: ${err}`);
  });
};

module.exports = {
  updateReview,
};
