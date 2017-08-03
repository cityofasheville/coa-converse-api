const sql = require('mssql');
const loadReview = require('./loadReview');
const getEmployee = require('./getEmployee.js');
const createCurrentReview = require('./createCurrentReview');
const operationIsAllowed = require('./operationIsAllowed');

const review = (obj, args, context) => {
  const pool = context.pool;
  const id = args.id;
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
          throw new Error('Employee query not allowed');
        });
      })
      .catch(err => {
        console.log(`Error doing review query: ${err}`);
      });
  }
  // Get based on the employee ID
  let employeeId = context.employee_id;
  if (args.hasOwnProperty('employee_id')) {
    employeeId = args.employee_id;
  }
  // AUTH HERE!!!!
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
          if (result2.recordset.length !== 1) {
            throw new Error(`Unable to retrieve conversation ${currentReview}`);
          }
          return loadReview(result2.recordset[0], { status: null });
        })
        .catch(err => {
          throw new Error(err);
        });
    });
};

const reviews = (obj, args, context) => {
  const pool = context.pool;
  const id = obj.id;
  const revs = [];
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
};

const questions = (obj, args, context) => {
  if (obj.questions === null) {
    const pool = context.pool;
    return pool.request()
    .input('ReviewID', sql.Int, obj.id)
    .execute('avp_get_review')
    .then((result) => {
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
