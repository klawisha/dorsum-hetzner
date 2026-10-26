SELECT json_build_object(
 'users',(SELECT count(*) FROM "User"),
 'clients',(SELECT count(*) FROM "ClientProfile"),
 'specialists',(SELECT count(*) FROM "SpecialistProfile"),
 'services',(SELECT count(*) FROM "Service"),
 'appointments',(SELECT count(*) FROM "Appointment"),
 'courses',(SELECT count(*) FROM "Course"),
 'coursePayments',(SELECT count(*) FROM "CoursePayment"),
 'courseCash',(SELECT COALESCE(round(sum(amount)::numeric,2),0) FROM "CoursePayment"),
 'paidAppointments',(SELECT count(*) FROM "Appointment" WHERE "paymentStatus"='PAID'),
 'oneOffCash',(SELECT COALESCE(round(sum(price)::numeric,2),0) FROM "Appointment" WHERE "paymentStatus"='PAID' AND "courseId" IS NULL),
 'clientImages',(SELECT count(*) FROM "ClientCardImage"),
 'clientImageDigest',(SELECT md5(COALESCE(string_agg(encode(sha256(data),'hex'),'' ORDER BY id),'')) FROM "ClientCardImage"),
 'receipts',(SELECT count(*) FROM "ExpenseReceipt"),
 'receiptDigest',(SELECT md5(COALESCE(string_agg(encode(sha256(data),'hex'),'' ORDER BY id),'')) FROM "ExpenseReceipt"),
 'expenses',(SELECT count(*) FROM "Expense"),
 'inventorySales',(SELECT count(*) FROM "InventorySale")
);
