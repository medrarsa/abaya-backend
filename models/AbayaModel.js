const mongoose = require('mongoose');

const abayaModelSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  code:          { type: String, required: true, unique: true },
  imageUrl:      { type: String },
  fabricType:    { type: String },            // نوع القماش
  metersNeeded:  { type: Number },            // ياخذ
  cutPrice:      { type: Number, default: 0 },      // سعر القص
  sewPrice:      { type: Number, default: 0 },      // سعر الخياطة
  ironPrice:     { type: Number, default: 0 },      // سعر الكواية
  embPrice:      { type: Number, default: 0 },      // سعر التطريز
  buttonPrice:   { type: Number, default: 0 },      // سعر الأزرار
  shipping:      { type: Number, default: 0 },      // الشحن
  reserve1:      { type: Number, default: 0 },
  reserve2:      { type: Number, default: 0 },
  reserve3:      { type: Number, default: 0 },
  reserve4:      { type: Number, default: 0 },
  reserve5:      { type: Number, default: 0 },
  reserve6:      { type: Number, default: 0 },
  stepPrices:    { type: Object }, // { "قصاص": 10, "خياط": 15, ... } (لو تحتاج مرونة مستقبلًا)
  isActive:      { type: Boolean, default: true }
});

module.exports = mongoose.model('AbayaModel', abayaModelSchema);
