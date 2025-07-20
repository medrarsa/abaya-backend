// backend/models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber:   { type: String },       // رقم الطلب
  customer:      { type: String },       // اسم العميل
  orderDate:     { type: String },       // تاريخ الطلب
  city:          { type: String },       // المدينة
  status:        { type: String },       // حالة الطلب
  priority:      { type: String },       // أولوية
  notes:         { type: String },       // ملاحظات
  groupDate:     { type: String },       // تاريخ المجموعة
  groupNumber:   { type: String },       // رقم المجموعة
  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
