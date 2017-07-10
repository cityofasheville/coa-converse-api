const sql = require('mssql');

const resolverMap = {
  Query: {
    employee(obj, args, context) {
      console.log('In employee query');
      const pool = context.pool;
      let id = args.id;
      if (id === null) id = '6507';
      // const empId = args.id ? args.id : context.employee_id;
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
      console.log(`Looking up employees for ${id}`);
      return pool.request()
        .input('UserEmpID', sql.Int, id)
        .execute('avp_Get_My_Employees')
        .then(result => {
          console.log(result);
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
      console.log('Looking up reviews on employee');
      const pool = context.pool;
      const id = obj.id;
      const reviews = [];
      return pool.request()
        .input('UserEmpID', sql.Int, id)
        .execute('avp_Reviews_of_Me')
        .then(result => {
          console.log(result);
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
