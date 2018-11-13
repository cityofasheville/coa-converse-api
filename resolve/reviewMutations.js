const sql = require('mssql');
const getReviewRecord = require('./getReviewRecord');
const getFullReview = require('./getFullReview');
const getEmployee = require('./getEmployee');
const notify = require('./notify');

/*
  Note on rewriting this:
    1. We should get the employee information earlier and check whether there
       is a valid switch of supervisor. Right now it's pretty confused logic.
*/
const updateReview = (root, args, context) => {
  const logger = context.logger;
  const rId = args.id;
  const inRev = args.review;
  let seq = Promise.resolve({ error: false });
  let newStatus = null;
  let transition = null;
  let toId = null; // We'll need for looking up email address.
  let toEmail = null;
  let supervisorChange = false; // Flag if a possible supervisor takeover.
  
  logger.info(`Updating review ${rId}`);
  if (context.email === null) {
    // Probably just a need to refresh the auth token
    throw new Error('User unauthenticated. '
    + 'This may simply be a token refresh problem. '
    + 'Try saving again.');
  }
  seq = getReviewRecord(rId, context) // Load information from Reviews table
  .then(review => {
    console.log(`Review record: ${JSON.stringify(review)}`);
    let employee = Promise.resolve({ id: null });
    // Verify we have a valid user and status transition
    let status = review.status;
    let periodEnd = review.periodEnd;
    let doSave = false;
    if (context.employee_id !== review.employee_id &&
        context.employee_id !== review.supervisor_id) {
      logger.warn(`Current id doesn't match either review employee id or supervisor id. Supervisor change? User email: ${context.email}`);
      employee = getEmployee(review.employee_id, context.pool, logger);
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
            supervisorChange = true;
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
            supervisorChange = true;
            errorString = 'Only supervisor may modify check-in in Acknowledged status';
          }
        } else if (status === 'Closed') {
          errorString = 'Status transition from Closed status is not allowed';
        }
        if (errorString !== null && !supervisorChange) { // Have to wait on supervisor change
          return Promise.resolve({ error: true, errorString });
        }

        if (status === 'Open') {
          transition = 'Ready';
          toId = review.employee_id;
        } else if (status === 'Ready') {
          if (newStatus === 'Open') transition = 'Reopen';
          else transition = 'Acknowledged';
          toId = review.supervisor_id;
        } else if (status === 'Acknowledged') {
          if (newStatus === 'Closed') transition = 'Closed';
          else transition = 'ReopenBySup';
          toId = review.employee_id;
        }

        status = newStatus;
        if (errorString !== null && !supervisorChange) {
          logger.error(`Check-in update error for user ${context.email}: ${errorString}`);
          throw new Error(errorString);
        }
      }
    }

    // Update values in Reviews table
    if (inRev.hasOwnProperty('periodEnd')) {
      // Need to validate
      doSave = true;
      periodEnd = inRev.periodEnd;
    }

    if (!doSave) return Promise.resolve({ error: false });
    console.log('Moving on ...');
    return employee.then((employeeInfo) => {
      let supervisorId = review.supervisor_id;
      const parameters = [
        rId,
        status,
        null, // periodStart
        periodEnd,
        supervisorId,
      ];
      const updQuery = 'UPDATE reviews.reviews SET status = $2, period_start = $3, ' +
      'period_end = $4, supervisor_id = $5 WHERE review_id = $1';
      if (employeeInfo.id !== null) { // Supervisor has changed or we have unauthorized save
        if (context.employee_id === employeeInfo.supervisor_id) {
          // Reset the supervisor in the review, there has been a change.
          logger.warn(`Changing the supervisor of this review to current user ${context.email}`);
          supervisorId = employeeInfo.supervisor_id;
        } else {
          logger.error(`Only the supervisor or employee can modify a check-in - user ${context.email}`);
          throw new Error('Only the supervisor or employee can modify a check-in');
        }
      }
      return context.pool
      .query(updQuery, parameters);
    });
  })
  .then(revRes => {
    console.log('Did the review update! ' + JSON.stringify(revRes));
    // if (revRes.error) return Promise.resolve(revRes);
    // if (revRes.rowsAffected === null || revRes.rowsAffected[0] !== 1) {
    //   return Promise.resolve({ error: true, errorString: 'Error updating period' });
    // }
    return Promise.resolve({ error: false });
  })
  .catch(revErr => {
    logger.error(`1Error updating check-in by ${context.email}: ${revErr}`);
    throw new Error(`1Error updating check-in: ${revErr}`);
  });
  // Done with Review table, deal with the questions, responses, notifications.
  return seq.then(res1 => {
    if (!res1.error && inRev.questions !== null && inRev.questions.length > 0) {
      const updateQuestions = inRev.questions.map(q => {
        const qId = q.id;
        const answer = (q.answer !== null) ? q.answer : '';
        return context.pool
        .query('UPDATE reviews.questions SET answer = $2 WHERE question_id = $1', [qId, answer])
        .then(qRes => {
          // if (qRes.rowsAffected === null || qRes.rowsAffected[0] !== 1) {
          //   throw new Error(`Error updating question ${qId}`);
          // }
          return Promise.resolve({ error: false });
        });
      });
      return Promise.all(updateQuestions);
    }
    return Promise.resolve(res1);
  })
  .then(res2 => { // Deal with response
    console.log('Deal with the response');
    if (!res2.error && inRev.responses !== null && inRev.responses.length > 0) {
      const updateResponses = inRev.responses.map(r => {
        if (r.question_id === null) {
          return context.pool
          .query('UPDATE reviews.responses SET response = $2 WHERE review_id = $1', [rId, r.Response]);
        }
        console.log('Now do the response query');
        const rQuery = 'UPDATE reviews.responses SET response = $3 WHERE (review_id = $1 AND question_id = $2)';
        return context.pool.query(rQuery, [rId, r.question_id, r.Response]);
      });
      return Promise.all(updateResponses);
    }
    return Promise.resolve(res2);
  })
  .then(res3 => {
    console.log('HERE WITH RES3: ' + JSON.stringify(res3));
    // All done - either error or return the updated review
    if (res3.error) {
      return Promise.resolve(res3);
    }

    return getFullReview(args.id, context, logger)
    .catch(err => {
      throw new Error(`Error doing check-in query: ${err}`);
    });
  })
  .then(revRes2 => {
    if (transition === null) return Promise.resolve(revRes2);
    const query = 'select email_city from internal.ad_info where emp_id = ' +
                  `'${toId}'`;
    return context.whPool.query(query)
    .then(email => {
      if (email.rows.length > 0) {
        toEmail = email.rows[0].email_city;
        return Promise.resolve(revRes2);
      }
      throw new Error('Changes have been saved, but unable to find email for notification.');
    });
  })
  .then(res4 => {
    console.log('RES4');
    if (transition === null || res4.error) {
      return Promise.resolve(res4);
    }
    // We have a status transition - trigger a notification.
    let subject;
    let body;
    let toAddress;
    let fromAddress;
    const link = 'https://check-in.ashevillenc.gov';

    switch (transition) {
      case 'Ready':
        subject = notify.texts.ready.subject;
        body = notify.createBody(notify.texts.ready.body, link);
        toAddress = toEmail;
        fromAddress = context.email;
        break;
      case 'Reopen':
        subject = notify.texts.reopen.subject;
        body = notify.createBody(notify.texts.reopen.body, link);
        toAddress = toEmail;
        fromAddress = context.email;
        break;
      case 'Acknowledged':
        subject = notify.texts.acknowledged.subject;
        body = notify.createBody(notify.texts.acknowledged.body, link);
        toAddress = toEmail;
        fromAddress = context.email;
        break;
      case 'Closed':
        subject = notify.texts.closed.subject;
        body = notify.createBody(notify.texts.closed.body, link);
        toAddress = toEmail;
        fromAddress = context.email;
        break;
      case 'ReopenBySup':
        subject = notify.texts.reopenbysup.subject;
        body = notify.createBody(notify.texts.reopenbysup.body, link);
        toAddress = toEmail;
        fromAddress = context.email;
        break;
      default:
        throw new Error(`Unknown status transition ${transition} for notification.`);
    }

    // https://medium.com/@yashoda.charith10/sending-emails-using-aws-ses-nodejs-460b8cc6d0d5

    // const doNotify = context.pool.request()
    // .input('ToAddress', sql.NVarChar, toAddress)
    // .input('FromAddress', sql.NVarChar, fromAddress)
    // .input('Subject', sql.NVarChar, subject)
    // .input('Body', sql.NVarChar, body)
    // .query('INSERT INTO Notifications '
    //   + '(ToAddress, FromAddress, Subject, BodyFormat, Body) '
    //   + "VALUES (@ToAddress, @FromAddress, @Subject,'HTML',@Body)");

    // return doNotify.then(res5 => {
    //   if (res5.error) {
    //     return Promise.resolve(res5);
    //   }
    //   return Promise.resolve(res4);
    // });
    console.log('now leave');
    return Promise.resolve(res4);
  })
  .catch(err => {
    logger.error(`Error updating check-in: ${err}`);
    throw new Error(`Error at check-in update end: ${err}`);
  });
};

module.exports = {
  updateReview,
};
