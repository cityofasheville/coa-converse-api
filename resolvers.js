const sql = require('mssql');

function getEmployee(id, pool) {
  return pool.request()
    .input('UserEmpID', sql.Int, id)
    .execute('avp_Get_Employee')
    .then(result => {
      const e = result.recordset[0];
      return Promise.resolve({
        id,
        active: e.Active,
        name: e.Employee,
        email: e.Emp_Email,
        position: e.Position,
        department: e.Department,
        division: e.Division,
        current_review: e.CurrentReview,
        last_reviewed: new Date(e.LastReviewed).toISOString(),
        review_by: new Date(e.ReviewBy).toISOString(),
        supervisor_id: e.SupID,
        supervisor_name: e.Supervisor,
        supervisor_email: e.Sup_Email,
        employees: [],
        reviews: null,
      });
    })
    .catch(err => {
      console.log(`Error getting employee: ${err}`);
      return Promise.resolve({ error: `Error getting employee: ${err}` });
    });
}

function loadReview(r, review) {
  let nreview;
  if (review.status === null) {
    nreview = {
      id: r.R_ID,
      status: r.Status,
      status_date: new Date(r.Status_Date).toISOString(),
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
  return nreview;
}

const resolverMap = {
  Mutation: {
    updateReview(root, args, context) {
      console.log(args);
      const rId = args.id;
      const inRev = args.review;
      let uAll = { error: false };
      let seq = Promise.resolve(null);
      if (inRev.hasOwnProperty('periodStart') || inRev.hasOwnProperty('periodEnd')) {
        // Need to test for valid input.
        if (inRev.hasOwnProperty('periodStart')) {
          uAll = `SET Period_Start = '${inRev.periodStart}'`;
        }
        if (inRev.hasOwnProperty('periodEnd')) {
          uAll = (uAll !== null) ? `${uAll}, ` : 'SET ';
          uAll += `Period_End = '${inRev.periodEnd}'`;
        }
        const revQ = `update Reviews ${uAll} WHERE R_ID = ${rId}`;
        console.log(revQ);
        seq = context.pool.request()
        .query(revQ)
        .then(revRes => {
          console.log(revRes);
          // Should at least test that we revRes.rowsAffected[0] = 1
          Promise.resolve({ error: false });
        })
        .catch(revErr => {
          console.log('ERROR!');
          console.log(revErr);
          Promise.resolve({ error: true, errorString: revErr });
        });
      }
      seq.next(res1 => {
        if (res1.error) {
          return Promise.resolve(res1);
        }
        return Promise.all();
      });
    },
  },
  Query: {
    employee(obj, args, context) {
      const pool = context.pool;
      if (args.hasOwnProperty('id')) {
        return getEmployee(args.id, pool);
      } else if (context.email !== null) {
        if (context.employee_id !== null) {
          return getEmployee(context.employee_id, pool);
        }
        // I think this block of code goes away now.
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
      if (args.hasOwnProperty('id')) {
        return pool.request()
          .input('ReviewID', sql.Int, id)
          .execute('avp_get_review')
          .then((result) => {
            let review = {
              status: null,
            };
            result.recordset.forEach(r => {
              review = loadReview(r, review);
            });
            return review;
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
      return getEmployee(employeeId, pool)
        .then(employee => {
          let currentReview = employee.current_review;
          if (currentReview === null || currentReview === 0) {
            const t1 = new Date();
            const t1s = `${t1.getFullYear()}-${t1.getMonth() + 1}-${t1.getDate()}`;
            const t2 = new Date(t1);
            t2.setDate(t1.getDate() + 90);
            const t2s = `${t2.getFullYear()}-${t2.getMonth() + 1}-${t2.getDate()}`;
            const thing = {
              employeeId,
              supervisorId: employee.supervisor_id,
              t1s,
              t2s,
            };
            return pool.request()
            .input('EmpID', sql.Int, employeeId)
            .input('SupID', sql.Int, employee.supervisor_id)
            .input('RT_ID', sql.Int, 2)
            .input('PeriodStart', sql.Date, t1s)
            .input('PeriodEnd', sql.Date, t2s)
            .output('R_ID', sql.Int)
            .execute('avp_New_Review')
            .then(result => {
              currentReview = result.output.R_ID;
              return pool.request()
                .input('ReviewID', sql.Int, currentReview)
                .execute('avp_get_review')
                .then((result2) => {
                  let review = {
                    status: null,
                  };
                  result2.recordset.forEach(r => {
                    review = loadReview(r, review);
                  });
                  return review;
                })
                .catch(err => {
                  console.log(`Error doing review query: ${err}`);
                });
            })
            .catch(err => {
              console.log(`ERROR CALLING NEW REVIEW: ${err}`);
            });
          }
          return pool.request()
            .input('ReviewID', sql.Int, currentReview)
            .execute('avp_get_review')
            .then((result2) => {
              let review = {
                status: null,
              };
              result2.recordset.forEach(r => {
                review = loadReview(r, review);
              });
              return review;
            })
            .catch(err => {
              console.log(`Error doing review query: ${err}`);
            });
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
