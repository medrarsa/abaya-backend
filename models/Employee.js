// backend/models/Employee.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  jobType: {
    type: String,
    enum: ['قصاص', 'خياط', 'مطرز', 'مركب أزرار', 'كواية', 'موظف الشحن', 'إداري', 'مدير'],
    required: true
  },
  salaryType: { type: String, enum: ['قطعة', 'راتب'], required: true },
  salaryAmount: { type: Number, required: true, default: 0 },
  username: { type: String, required: true, unique: true },
  phone: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // سيتم تشفيره تلقائيًا
  status: { type: String, enum: ['فعال', 'موقوف'], default: 'فعال' },
  createdAt: { type: Date, default: Date.now }
});

// تشفير كلمة المرور قبل الحفظ (يعمل تلقائيًا)
employeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// مقارنة كلمة المرور أثناء تسجيل الدخول
employeeSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Employee', employeeSchema);
