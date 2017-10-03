const sql = require('mssql');
const getReview = require('./getReview');
const loadReview = require('./loadReview');

const updateReview = (root, args, context) => {
  const rId = args.id;
  const inRev = args.review;
  let seq = Promise.resolve({ error: false });
  let newStatus = null;
  let transition = null;
  seq = getReview(rId, context)
  .then(review => {
    let status = review.status;
//    let periodStart = review.periodStart;
    let periodEnd = review.periodEnd;
    let doSave = false;

    if (context.employee_id !== review.employee_id &&
        context.employee_id !== review.supervisor_id) {
      throw new Error('Only the supervisor or employee can modify a conversation');
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
            errorString = 'Only supervisor may modify conversation in Open status';
          }
        } else if (status === 'Ready') {
          if (newStatus !== 'Open' && newStatus !== 'Acknowledged') {
            errorString = `Invalid status transition from ${status} to ${newStatus}`;
          }
          if (context.employee_id !== review.employee_id) {
            errorString = 'Only employee may modify conversation in Ready status';
          }
        } else if (status === 'Acknowledged') {
          if (newStatus !== 'Open' && newStatus !== 'Closed') {
            errorString = `Invalid status transition from ${status} to ${newStatus}`;
          }
          if (context.employee_id !== review.supervisor_id) {
            errorString = 'Only supervisor may modify conversation in Acknowledged status';
          }
        } else if (status === 'Closed') {
          errorString = 'Status transition from Closed status is not allowed';
        }
        if (errorString !== null) {
          return Promise.resolve({ error: true, errorString });
        }

        if (status === 'Open') {
          transition = 'Ready';
        } else if (status === 'Ready') {
          if (newStatus === 'Open') transition = 'Reopen';
          else transition = 'Acknowledged';
        } else if (status === 'Acknowledged') {
          if (newStatus === 'Closed') transition = 'Closed';
          else transition = 'Reacknowledge';
        }
        console.log(`review is ${JSON.stringify(review)}`);

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
    throw new Error(`Error updating conversation: ${revErr}`);
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
        throw new Error(`Error doing conversation query: ${err}`);
      });
  })
  .then(res4 => {
    if (transition === null || res4.error) {
      return Promise.resolve(res4);
    }
    // We have a status transition - trigger a notification.
    const employeeEmail = res4.employee_email;
    const supervisorEmail = res4.supervisor_email;
    let subject;
    let body;
    let toAddress;
    console.log(`The transition is ${transition}`);
    console.log(`Possible addresses: ${employeeEmail}, ${supervisorEmail}`);
    switch (transition) {
      case 'Ready':
        console.log('Yes I am really ready');
        subject = 'Your latest check-in is ready for your acknowledgment';
        body = 'Your latest check-in is ready for your acknowledgment';
        toAddress = employeeEmail;
        break;
      case 'Reopen':
        subject = 'You have a check-in that has been re-opened';
        body = 'You have a check-in that has been re-opened';
        toAddress = supervisorEmail;
        break;
      case 'Acknowledged':
        subject = 'You have a check-in that has been acknowledged';
        body = 'You have a check-in that has been acknowledged';
        toAddress = supervisorEmail;
        break;
      case 'Closed':
        subject = 'Your supervisor has closed your latest check-in';
        body = 'Your supervisor has closed your latest check-in';
        toAddress = employeeEmail;
        break;
      case 'Reacknowledge':
        subject = 'Your supervisor has requested that you re-review your latest check-in';
        body = 'Your supervisor has requested that you re-review your latest check-in';
        toAddress = employeeEmail;
        break;
      default:
        console.log(`No idea, but I am in default with ${transition}`);
        break;
    }
    console.log('Updating notifications');
    console.log(`To: ${toAddress}`);
    const notify = context.pool.request()
    .input('ToAddress', sql.NVarChar, toAddress)
    .input('Subject', sql.NVarChar, subject)
    .input('Body', sql.NVarChar, body)
    .query('INSERT INTO Notifications '
      + '(ToAddress, FromAddress, Subject, BodyFormat, Body) '
      + "VALUES (@ToAddress, 'ejackson@ashevillenc.gov', @Subject,'t',@Body)");

    return notify.then(res5 => {
      if (res5.error) {
        return Promise.resolve(res5);
      }
      return Promise.resolve(res4);
    });
  })
  .catch(err => {
    throw new Error(`Error at conversation update end: ${err}`);
  });
};

module.exports = {
  updateReview,
};
