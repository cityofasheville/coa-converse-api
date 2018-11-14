const sql = require('mssql');
const getFullReview = require('./getFullReview');
const getEmployee = require('./getEmployee.js');
const createCurrentReview = require('./createCurrentReview');
const operationIsAllowed = require('./operationIsAllowed');

const review = (obj, args, context) => {
  console.log('In review');
  const pool = context.pool;
  const logger = context.logger;
  const id = args.id;

  if (args.hasOwnProperty('id') && id !== -1) {
    return getFullReview(id, context)
    .then(reviewOut => {
      if (context.employee_id === reviewOut.employee_id) {
        return reviewOut;
      }
      return operationIsAllowed(reviewOut.supervisor_id, context)
      .then(isAllowed => {
        if (isAllowed) {
          return reviewOut;
        }
        throw new Error('Check-in query not allowed');
      });
    })
    .catch(err => {
      logger.error(`Error doing check-in query by ${context.email}: ${err}`);
    });
  }
  // Get based on the employee ID
  let employeeId = context.employee_id;
  let verifyAllowed = Promise.resolve(true);
  if (args.hasOwnProperty('employee_id')) {
    if (args.employeeId !== employeeId) {
      employeeId = args.employee_id;
      verifyAllowed = operationIsAllowed(employeeId, context);
    }
  }

  return verifyAllowed.then(isAllowed => {
    if (isAllowed) {
      return getEmployee(employeeId, pool, context.whPool, context.logger)
        .then(emp => {
          const currentReview = emp.current_review;
          if (currentReview === null || currentReview === 0) {
            return createCurrentReview(emp, context);
          }
          return getFullReview(currentReview, context)
          .catch(err => {
            logger.error(`Error retrieving check-in for ${context.email}: ${err}`);
            throw new Error(err);
          });
        });
    }
    logger.error(`Check-in query not allowed for user ${context.email}`);
    throw new Error(`Check-in query not allowed for user ${context.email}`);
  });
};

const reviews = (obj, args, context) => {
  console.log('In reviews');
  const pool = context.pool;
  const logger = context.logger;
  const id = obj.id;
  let verifyAllowed = Promise.resolve(true);
  if (id !== context.employee_id) {
    verifyAllowed = operationIsAllowed(id, context);
  }
  return verifyAllowed
  .then(isAllowed => {
    if (isAllowed) {
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
              const e = eMap[id];
              const s = eMap[r.supervisor_id];
              const rev = {
                id: r.review_id,
                status: r.status,
                status_date: new Date(r.status_date).toISOString(),
                supervisor_id: r.supervisor_id,
                employee_id: r.employee_id,
                position: r.position,
                periodStart: null, // Currently not in use
                periodEnd: new Date(r.period_end).toISOString(),
                reviewer_name: s.employee,
                employee_name: e.employee,
                questions: null,
                responses: null,
              };
              return rev;
            });
          });
        });
    }
    logger.error(`Check-ins query not allowed for user ${context.email}`);
    throw new Error('Check-ins query not allowed');
  });
};

const questions = (obj, args, context) => {
  if (obj.questions === null) {
    const pool = context.pool;
    const logger = context.logger;
    return pool.request()
    .input('ReviewID', sql.Int, obj.id)
    .execute('avp_get_review')
    .then((result) => {
      if (result.recordset.length > 0) {
        let verifyAllowed;
        const rev = result.recordset[0];
        if (context.employee_id === rev.employee_id &&
            context.employee_id === rev.supervisor_id) {
          verifyAllowed = Promise.resolve(true);
        } else {
          verifyAllowed = operationIsAllowed(rev.supervisor_id, context);
        }
        return verifyAllowed.then(isAllowed => {
          if (isAllowed) {
            const qs = [];
            result.recordset.forEach(r => {
              questions.push(
                {
                  id: r.Q_ID,
                  type: r.QT_Type,
                  question: r.QT_Question,
                  answer: r.Answer,
                  required: r.Required,
                }
              );
            });
            return qs;
          }
          logger.error('Access not allowed to questions for this check-in.');
          throw new Error('Access not allowed to questions for this check-in.');
        });
      }
      logger.error(`Check-in ${obj.id} not found.`);
      throw new Error(`Check-in ${obj.id} not found.`);
    });
  }
  return obj.questions;
};

const responses = (obj, args, context) => {
  if (obj.responses === null) {
    const pool = context.pool;
    const logger = context.logger;
    return pool.request()
    .input('ReviewID', sql.Int, obj.id)
    .execute('avp_get_review')
    .then((result) => {
      const rev = result.recordset[0];
      let verifyAllowed;
      if (context.employee_id === rev.employee_id &&
          context.employee_id === rev.supervisor_id) {
        verifyAllowed = Promise.resolve(true);
      } else {
        verifyAllowed = operationIsAllowed(rev.supervisor_id, context);
      }
      return verifyAllowed.then(isAllowed => {
        if (isAllowed) {
          const rs = [];
          const r = result.recordset[0];
          rs.push(
            {
              review_id: obj.id,
              question_id: null,
              Response: r.Response,
            }
          );
          return rs;
        }
        logger.error('Access not allowed to responses for this check-in.');
        throw new Error('Access not allowed to responses for this check-in.');
      });
    });
  }
  return obj.responses;
};

module.exports = {
  review,
  reviews,
  questions,
  responses,
};
