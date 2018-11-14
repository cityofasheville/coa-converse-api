
const reviewableTypes = ['CA', 'FT', 'IN', 'PB', 'PN'];
const isReviewable = (e) => {
  return (
    e.active === 'A' &&
    e.emp_email !== null && e.emp_email !== '' &&
    e.emp_email.toLowerCase().endsWith('ashevillenc.gov') &&
    reviewableTypes.includes(e.ft_status)
  );
};

const notReviewableReason = (e) => {
  let reason = null;
  if (!isReviewable(e)) {
    if (e.Active !== 'A') reason = 'Inactive';
    else if (!reviewableTypes.includes(e.FT_Status)) reason = 'Non-included employee type';
    else if (e.Position === null || e.Position === '') reason = 'No position';
    else if (!e.emp_email.toLowerCase().endsWith('ashevillenc.gov')) reason = 'City of Asheville email required';
    else reason = 'Employee not registered for Employee Check-in';
  }
  return reason;
};

module.exports = {
  isReviewable,
  notReviewableReason,
};
