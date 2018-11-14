/* eslint-disable max-len */

const texts = {
  ready: {
    subject: 'Your latest check-in',
    body: [
      "Your supervisor has completed your latest check-in. Please review the check-in and feel free to add your own comments. Once you've completed your portion, please acknowledge you have reviewed the check-in. If you have questions about your supervisor's comments or would like to discuss further, please re-open the check-in. Thank you for your participation.",
    ],
  },
  reopen: {
    subject: 'You have a check-in that has been re-opened',
    body: [
      'Your employee reviewed the latest check-in and has asked to re-open the dialogue. Please meet with your employee to discuss any questions or unresolved issues. Review and/or revise the check-in and complete your portion before sending it back to the employee to review and acknowledge.',
    ],
  },
  acknowledged: {
    subject: 'You have a check-in that has been acknowledged',
    body: [
      'Your employee has reviewed and acknowledged the latest check-in. You can now complete and close this check-in.',
    ],
  },
  closed: {
    subject: 'Your supervisor has closed your latest check-in',
    body: [
      'Your supervisor has completed and closed your latest check-in. You may review the dialogue at any time.',
    ],
  },
  reopenbysup: {
    subject: 'Your supervisor has re-opened your check-in',
    body: [
      'Your supervisor has re-opened your latest check-in. You will receive another notification when it is ready for your review and acknowledgment.',
    ],
  },
};

const createBody = (bodyParagraphs, link) => {
  const body = bodyParagraphs.reduce((prevVal, curVal) => `${prevVal}<p>${curVal}</p>`, '');
  const lBody = `<p><a href="${link}">Visit check-in tool</a>.</p>`;
  return body + lBody;
};

const notify = (transition, fromAddress, toAddress) => {
  let subject;
  let body;
  const link = 'https://check-in.ashevillenc.gov';

  switch (transition) {
    case 'Ready':
      ({ subject } = texts.ready);
      body = createBody(texts.ready.body, link);
      break;
    case 'Reopen':
      ({ subject } = texts.reopen);
      body = createBody(texts.reopen.body, link);
      break;
    case 'Acknowledged':
      ({ subject } = texts.acknowledged);
      body = createBody(texts.acknowledged.body, link);
      break;
    case 'Closed':
      ({ subject } = texts.closed);
      body = createBody(texts.closed.body, link);
      break;
    case 'ReopenBySup':
      ({ subject } = texts.reopenbysup);
      body = createBody(texts.reopenbysup.body, link);
      break;
    default:
      throw new Error(`Unknown status transition ${transition} for notification.`);
  }
  // https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/ses-examples-sending-email.html
  console.log(`Send email from ${fromAddress} to ${toAddress}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}`);
  return Promise.resolve(null);
};

module.exports = notify;
