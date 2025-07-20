// backend/models/OrderItemStep.js

const mongoose = require('mongoose');

const orderItemStepSchema = new mongoose.Schema({
orderItem: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderItem', required: true },
  stepName:     { type: String, required: true }, // مثال: "قص", "خياطة", "مطرز", ...
  employee:     { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  status:       { type: String, enum: ['جديد', 'قيد التنفيذ', 'منجز'], default: 'جديد' },
  receivedAt:   { type: Date }, // متى استلمها الموظف
  finishedAt:   { type: Date }, // متى خلصها الموظف
  location:     { type: String }, // إحداثيات GPS (اختياري)
  amount: { type: Number, default: 0 }, // سعر الخدمة المنفذ في كل خطوة
  notes:        { type: String }
  
});

module.exports = mongoose.model('OrderItemStep', orderItemStepSchema);
