// models/FabricLog.js
const mongoose = require('mongoose');

const fabricLogSchema = new mongoose.Schema({
  fabric:    { type: mongoose.Schema.Types.ObjectId, ref: 'Fabric', required: true },   // القماش المرتبط
  type:      { type: String, enum: ['in', 'out'], required: true },                    // "in" = دخول، "out" = خروج
  qty:       { type: Number, required: true },                                         // كمية الدخول/الخروج
  orderItem: { type: mongoose.Schema.Types.ObjectId, ref: 'OrderItem' },               // رقم القطعة (عند الخروج فقط)
  employeeUsername: { type: String, required: true },                                 // اسم المستخدم (username) للموظف
  note:      { type: String },
  cost:      { type: Number },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FabricLog', fabricLogSchema);
