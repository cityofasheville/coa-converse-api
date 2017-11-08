const sql = require('mssql');
const loadReview = require('./loadReview');
const getEmployee = require('./getEmployee.js');
const createCurrentReview = require('./createCurrentReview');
const operationIsAllowed = require('./operationIsAllowed');

const review = (obj, args, context) => {
  const pool = context.pool;
  const id = args.id;
  console.log(`Getting employee check-in ${id}`);
  if (args.hasOwnProperty('id') && id !== -1) {
    return pool.request()
      .input('ReviewID', sql.Int, id)
      .execute('avp_get_review')
      .then((result) => {
        let rev = {
          status: null,
        };
        result.recordset.forEach(r => {
          rev = loadReview(r, rev);
        });
        if (context.employee_id === rev.employee_id) {
          return rev;
        }
        return operationIsAllowed(rev.supervisor_id, context)
        .then(isAllowed => {
          if (isAllowed) {
            return rev;
          }
          throw new Error('Check-in query not allowed');
        });
      })
      .catch(err => {
        console.log(`Error doing check-in query: ${err}`);
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
      return getEmployee(employeeId, pool)
        .then(emp => {
          const currentReview = emp.current_review;
          if (currentReview === null || currentReview === 0) {
            return createCurrentReview(emp, pool);
          }
          return pool.request()
            .input('ReviewID', sql.Int, currentReview)
            .execute('avp_get_review')
            .then((result2) => {
              if (result2.recordset.length < 1) {
                throw new Error(`Unable to retrieve check-in ${currentReview}`);
              }
              return loadReview(result2.recordset[0], { status: null });
            })
            .catch(err => {
              throw new Error(err);
            });
        });
    }
    throw new Error('Check-in query not allowed');
  });
};

const reviews = (obj, args, context) => {
  const pool = context.pool;
  const id = obj.id;
  const revs = [];
  let verifyAllowed = Promise.resolve(true);
  if (id !== context.employee_id) {
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
              periodStart: new Date(r.Period_Start).toISOString(),
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
    throw new Error('Check-ins query not allowed');
  });
};

const questions = (obj, args, context) => {
  if (obj.questions === null) {
    const pool = context.pool;
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
          throw new Error('Access not allowed to questions for this check-in.');
        });
      }
      throw new Error(`Check-in ${obj.id} not found.`);
    });
  }
  return obj.questions;
};

const responses = (obj, args, context) => {
  if (obj.responses === null) {
    const pool = context.pool;
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
