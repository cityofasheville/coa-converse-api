const { updateReview } = require('./resolve/reviewMutations');
const { employee, employees } = require('./resolve/employeeQueries');
const { review, reviews, questions, responses } = require('./resolve/reviewQueries');

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
