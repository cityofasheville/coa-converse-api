INSERT INTO QuarterlyReviews.dbo.Employees (
	EmpID, Active, Employee, Emp_Email, Position, DeptID, Department,
	DivID, Division, SupID, Supervisor, Sup_Email, Hire_Date)
VALUES (
	9991, 'A', 'BPT TESTUSER1', 'bpt_testuser1@ashevillenc.gov', 'SYSTEMS ANALYST I', '05', 'Information Technology',
	'054', 'IT Gis Appl Services', 6507, 'ERIC JACKSON', 'ejackson@ashvillenc.gov', '2016-08-15'
);
INSERT INTO QuarterlyReviews.dbo.Employees (
	EmpID, Active, Employee, Emp_Email, Position, DeptID, Department,
	DivID, Division, SupID, Supervisor, Sup_Email, Hire_Date)
VALUES (
	9992, 'A', 'BPT TESTUSER2', 'bpt_testuser2@ashevillenc.gov', 'SYSTEMS ANALYST I', '05', 'Information Technology',
	'054', 'IT Gis Appl Services', 9991, 'BPT TestUser1', 'bpt_testuser1@ashvillenc.gov', '2016-08-15'
);
