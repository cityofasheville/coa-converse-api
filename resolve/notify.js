/* eslint-disable max-len */

const ready = {
  subject: 'Your latest check-in',
  body: [
    "Your supervisor has completed your latest check-in. Please review the check-in and feel free to add your own comments. Once you've completed your portion, please acknowledge you have reviewed the check-in. If you have questions about your supervisor's comments or would like to discuss further, please re-open the check-in. Thank you for your participation.",
  ],
};

const reopen = {
  subject: 'You have a check-in that has been re-opened',
  body: [
    'Your employee reviewed the latest check-in and has asked to re-open the dialogue. Please meet with your employee to discuss any questions or unresolved issues. Review and/or revise the check-in and complete your portion before sending it back to the employee to review and acknowledge.',
  ],
};

const acknowledged = {
  subject: 'You have a check-in that has been acknowledged',
  body: [
    'Your employee has reviewed and acknowledged the latest check-in. You can now complete and close this check-in.',
  ],
};

const closed = {
  subject: 'Your supervisor has closed your latest check-in',
  body: [
    'Your supervisor has completed and closed your latest check-in. You may review the dialogue at any time.',
  ],
};

const reopenbysup = {
  subject: 'Your supervisor has re-opened your check-in',
  body: [
    'Your supervisor has re-opened your latest check-in. You will receive another notification when it is ready for your review and acknowledgment.',
  ],
};

const createBody = (bodyParagraphs, link) => {
  const body = bodyParagraphs.reduce((prevVal, curVal) => {
    return `${prevVal}<p>${curVal}</p>`;
  }, '');
  const lBody = `<p>Go to <a href="${link}">check-in</a> now.</p>`;
  return body + lBody;
};

module.exports = {
  texts: {
    ready,
    reopen,
    acknowledged,
    closed,
    reopenbysup,
  },
  createBody,
};
