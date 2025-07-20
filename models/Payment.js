const mongoose = require('mongoose');
const paymentSchema = new mongoose.Schema({
  employee:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  amount:     { type: Number, required: true }, // المبلغ المدفوع أو المخصوم
  type:       { type: String, enum: ["دفعة", "سلفة", "خصم", "مستحق"], default: "مستحق" }, // نوع الدفعة أو المستحق
  orderItem:  { type: mongoose.Schema.Types.ObjectId, ref: 'OrderItem' }, // ربط العملية بقطعة/طلب (اختياري)
  stepName:   { type: String }, // اسم المرحلة (قصاص، خياط...) (اختياري)
  status:     { type: String, enum: ["pending", "paid"], default: "pending" }, // حالة الدفعة
  date:       { type: Date, default: Date.now },
  notes:      { type: String }
});
module.exports = mongoose.model('Payment', paymentSchema);
