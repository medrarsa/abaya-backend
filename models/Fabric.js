const mongoose = require('mongoose');

const fabricSchema = new mongoose.Schema({
  name:         { type: String, required: true },
    code: { type: String, unique: true },     // ← هنا نخزن F100, F200, إلخ
  currentStock: { type: Number, default: 0 },
  minAlert:     { type: Number, default: 0 },
  unitPrice:    { type: Number, default: 0 },
  createdAt:    { type: Date, default: Date.now },
    archived: { type: Boolean, default: false } // حقل الأرشفة
});

module.exports = mongoose.model('Fabric', fabricSchema);
