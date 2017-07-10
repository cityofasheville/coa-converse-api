const sql = require('mssql');

function getEmployee(id, pool) {
  return pool.request()
    .input('UserEmpID', sql.Int, id)
    .execute('avp_Get_Employee')
    .then(result => {
      const e = result.recordset[0];
      return {
        id,
        active: e.Active,
        name: e.Employee,
        email: e.Emp_Email,
        position: e.Position,
        department: e.Department,
        division: e.Division,
        last_reviewed: new Date(e.LastReviewed).toISOString(),
        review_by: new Date(e.ReviewBy).toISOString(),
        supervisor_id: e.SupID,
        supervisor_name: e.Supervisor,
        supervisor_email: e.Sup_Email,
        employees: [],
        reviews: null,
      };
    })
    .catch(err => {
      console.log(`Error getting employee: ${err}`);
    });
}
const resolverMap = {
  Query: {
    employee(obj, args, context) {
      const pool = context.pool;
      if (args.hasOwnProperty('id')) {
        return getEmployee(args.id, pool);
      } else if (context.email !== null) {
        const query = `select EmpID from UserMap where Email = '${context.email}'`;
        return pool.request()
        .query(query)
        .then(result => {
          console.log(result);
          if (result.recordset.length > 0) {
            const id = result.recordset[0].EmpID;
            return getEmployee(id, pool);
          }
          return null;
        })
        .catch(err => {
          console.log(`Error getting employee ID for email ${context.email}: ${err}`);
        });
      }
      return null;
    },
    review(obj, args, context) {
      const pool = context.pool;
      const id = args.id;
      return pool.request()
        .input('ReviewID', sql.Int, id)
        .execute('avp_get_review')
        .then((result) => {
          let review = null;
          result.recordset.forEach(r => {
            if (review === null) {
              review = {
                id,
                status: r.Status,
                supervisor_id: r.EmpSupID,
                employee_id: r.EmpID,
                position: r.Position,
                periodStart: new Date(r.Period_Start).toISOString(),
                periodEnd: new Date(r.Period_End).toISOString(),
                reviewer_name: r.Reviewer,
                employee_name: r.Employee,
                questions: [],
                responses: [
                  {
                    question_id: null,
                    Response: r.Response,
                  },
                ],
              };
            }
            review.questions.push(
              {
                id: r.Q_ID,
                type: r.QT_Type,
                question: r.QT_Question,
                answer: r.Answer,
                required: r.Required,
              }
            );
          });
          return review;
        })
        .catch(err => {
          console.log(`Error doing review query: ${err}`);
        });
    },
  },
  Employee: {
    employees(obj, args, context) {
      const pool = context.pool;
      const id = obj.id;
      const employees = [];
      return pool.request()
        .input('UserEmpID', sql.Int, id)
        .execute('avp_Get_My_Employees')
        .then(result => {
          result.recordset.forEach(e => {
            const employee = {
              id: e.EmpID,
              active: e.Active,
              name: e.Employee,
              email: e.Emp_Email,
              position: e.Position,
              department: e.Department,
              division: e.Division,
              last_reviewed: new Date(e.LastReviewed).toISOString(),
              review_by: new Date(e.ReviewBy).toISOString(),
              supervisor_id: e.SupID,
              supervisor_name: e.Supervisor,
              supervisor_email: e.Sup_Email,
              employees: null,
              reviews: null,
            };
            console.log(`  Employee: ${employee.name}`);
            employees.push(employee);
          });
          return employees;
        });
    },
    reviews(obj, args, context) {
      const pool = context.pool;
      const id = obj.id;
      const reviews = [];
      return pool.request()
        .input('UserEmpID', sql.Int, id)
        .execute('avp_Reviews_of_Me')
        .then(result => {
          result.recordset.forEach(r => {
            const review = {
              id: r.R_ID,
              status: r.Status,
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
            reviews.push(review);
          });
          return reviews;
        });
    },
  },
  Review: {
    questions(obj, args, context) {
      if (obj.questions === null) {
        const pool = context.pool;
        return pool.request()
        .input('ReviewID', sql.Int, obj.id)
        .execute('avp_get_review')
        .then((result) => {
          const questions = [];
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
          return questions;
        });
      }
      return obj.questions;
    },
    responses(obj, args, context) {
      console.log('Looking up responses on review');
      if (obj.responses === null) {
        const pool = context.pool;
        return pool.request()
        .input('ReviewID', sql.Int, obj.id)
        .execute('avp_get_review')
        .then((result) => {
          const responses = [];
          const r = result.recordset[0];
          responses.push(
            {
              review_id: obj.id,
              question_id: null,
              Response: r.Response,
            }
          );
          return responses;
        });
      }
      return obj.responses;
    },
  },
};

module.exports = resolverMap;
