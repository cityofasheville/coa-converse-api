const sql = require('mssql');
const getFullReview = require('./getFullReview');
const getEmployee = require('./getEmployee.js');
const createCurrentReview = require('./createCurrentReview');
const operationIsAllowed = require('./operationIsAllowed');

const review = (obj, args, context) => {
  const pool = context.pool;
  const logger = context.logger;
  const id = args.id;

  logger.info(`Getting employee check-in ${id}`);
  if (args.hasOwnProperty('id') && id !== -1) {
    return getFullReview(id, pool, logger)
    .then(reviewOut => {
      if (context.employee.employee_id === reviewOut.employee_id) {
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
      logger.error(`Error doing check-in query by ${context.user.email}: ${err}`);
    });
  }
  // Get based on the employee ID
  let employeeId = context.employee.employee_id;
  let verifyAllowed = Promise.resolve(true);
  if (args.hasOwnProperty('employee_id')) {
    if (args.employeeId !== employeeId) {
      employeeId = args.employee_id;
      verifyAllowed = operationIsAllowed(employeeId, context);
    }
  }

  return verifyAllowed.then(isAllowed => {
    if (isAllowed) {
      return getEmployee(employeeId, pool)
        .then(emp => {
          const currentReview = emp.current_review;
          if (currentReview === null || currentReview === 0) {
            return createCurrentReview(emp, pool, logger);
          }
          return getFullReview(currentReview, pool, logger)
          .catch(err => {
            logger.error(`Error retrieving check-in for ${context.user.email}: ${err}`);
            throw new Error(err);
          });
        });
    }
    logger.error(`Check-in query not allowed for user ${context.user.email}`);
    throw new Error(`Check-in query not allowed for user ${context.user.email}`);
  });
};

const reviews = (obj, args, context) => {
  const pool = context.pool;
  const logger = context.logger;
  const id = obj.id;
  const revs = [];
  let verifyAllowed = Promise.resolve(true);
  if (id !== context.employee.employee_id) {
    verifyAllowed = operationIsAllowed(id, context);
  }
  return verifyAllowed
  .then(isAllowed => {
    if (isAllowed) {
      return pool.request()
        .input('UserEmpID', sql.Int, id)
        .execute('avp_Reviews_of_Me')
        .then(result => {
          result.recordset.forEach(r => {
            const rev = {
              id: r.R_ID,
              status: r.Status,
              status_date: new Date(r.Status_Date).toISOString(),
              supervisor_id: r.SupID,
              employee_id: r.EmpID,
              position: r.Position,
              periodStart: null, // Currently not in use
              periodEnd: new Date(r.Period_End).toISOString(),
              reviewer_name: r.Reviewer,
              employee_name: r.Employee,
              questions: null,
              responses: null,
            };
            revs.push(rev);
          });
          return revs;
        });
    }
    logger.error(`Check-ins query not allowed for user ${context.user.email}`);
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
        if (context.employee.employee_id === rev.employee_id &&
            context.employee.employee_id === rev.supervisor_id) {
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
      if (context.employee.employee_id === rev.employee_id &&
          context.employee.employee_id === rev.supervisor_id) {
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
