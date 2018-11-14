const { updateReview } = require('./resolve/review_mutations');
const { employee, employees } = require('./resolve/employee_queries');
const { review, reviews, questions, responses } = require('./resolve/review_queries');

const resolverMap = {
  Mutation: {
    updateReview,
  },
  Query: {
    employee,
    review,
  },
  Employee: {
    employees,
    reviews,
  },
  Review: {
    questions,
    responses,
  },
};

module.exports = resolverMap;
