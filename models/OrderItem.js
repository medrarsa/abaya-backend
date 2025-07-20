// backend/models/OrderItem.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderItemSchema = new mongoose.Schema({
  order:         { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  model:         { type: String },     // رقم الموديل
  modelName:     { type: String },     // اسم الموديل
  size:          { type: String },     // المقاس
  fabric:        { type: String },     // رقم القماش
  fabricName:    { type: String },     // اسم القماش
  quantity:      { type: String },     // الكمية
  pieceSequence: { type: String },     // تسلسل القطعة
  status:        { type: String },     // حالة القطعة (يأخذها من حالة الطلب أو تتركها هنا)
  notes:         { type: String },     // ملاحظات
  priority:      { type: String },     // أولوية
  groupDate:     { type: String },     // تاريخ المجموعة
  groupNumber:   { type: String },     // رقم المجموعة
  barcode:       { type: String, unique: true, default: uuidv4 },
  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('OrderItem', orderItemSchema);
