const ready = {
  subject: 'Your latest check-in',
  body: 'Your supervisor has completed your latest check-in. Please review the check-in and feel free to add your own comments. Once you've completed your portion, please acknowledge you have reviewed the check-in. If you have questions about your supervisor's comments or would like to discuss further, please re-open the check-in. Thank you for your participation.',
};

const reopen = {
  subject: '',
  body: '',
};

const acknowledged = {
  body: '',
};

const closed = {
  subject: '',
  body: '',
};

const reopenbysup = {
  subject: '',
  body: '',
};

module.exports = {
  ready,
  reopen,
  acknowledged,
  closed,
  reopenbysup,
};



case 'Reopen':
subject = 'You have a check-in that has been re-opened';
body = 'You have a check-in that has been re-opened';
toAddress = toEmail;
fromAddress = context.email;
break;
case 'Acknowledged':
subject = 'You have a check-in that has been acknowledged';
body = 'You have a check-in that has been acknowledged';
toAddress = toEmail;
fromAddress = context.email;
break;
case 'Closed':
subject = 'Your supervisor has closed your latest check-in';
body = 'Your supervisor has closed your latest check-in';
toAddress = toEmail;
fromAddress = context.email;
break;
case 'ReopenBySup':
subject = 'Your supervisor has reopened your check-in';
body = 'Your supervisor has reopened your check-in. You will receive another notification when it is ready for acknowledgment.';
toAddress = toEmail;
fromAddress = context.email;
break;
