const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const mongoose = require('mongoose');

// مؤقت: استخدم Map (للإنتاج استخدم Redis أو جدول OTP مستقل)
const OTPMap = {};

// 1. إرسال كود التحقق للموظف على الجوال (واتساب/SMS)
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "رقم الجوال مطلوب" });

  // ابحث عن الموظف (رقم الجوال يجب أن يكون موجود بجدول الموظفين)
  const employee = await Employee.findOne({ phone });
  if (!employee || employee.status !== "فعال")
    return res.status(404).json({ error: "الموظف غير موجود أو موقوف" });

  // أنشئ كود عشوائي 5 أرقام (مدة الصلاحية دقيقتين)
  const code = Math.floor(10000 + Math.random() * 90000);
  OTPMap[phone] = { code, expires: Date.now() + 2 * 60 * 1000 };

  // أرسل الكود على واتساب (أو SMS - للتجربة فقط: اطبعه في الكونسول)
  await sendWhatsappOTP(phone, code);

  res.json({ success: true, msg: "تم إرسال كود التحقق عبر واتساب" });
});

// 2. التحقق من كود التحقق (OTP) وتسجيل الدخول
router.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body;
  const entry = OTPMap[phone];
  if (!entry || String(entry.code) !== String(code) || entry.expires < Date.now())
    return res.status(400).json({ error: "الكود غير صحيح أو انتهت صلاحيته" });

  // جلب الموظف
  const employee = await Employee.findOne({ phone });
  if (!employee) return res.status(404).json({ error: "الموظف غير موجود" });

  // حذف الكود بعد التحقق (أمان)
  delete OTPMap[phone];

  // هنا يمكنك إصدار JWT أو Session للمستخدم
  // ... مثال بدون JWT (أرسل بيانات الموظف فقط)
  res.json({
    success: true,
    user: {
      _id: employee._id,
      name: employee.name,
      phone: employee.phone,
      jobType: employee.jobType,
      role: employee.role || employee.jobType,
      status: employee.status
    }
  });
});

// 3. دالة إرسال الكود على واتساب (أو SMS)
async function sendWhatsappOTP(phone, code) {
  // ⚠️ استبدل هذا بكود الربط الحقيقي مع مزود واتساب (ultramsg أو WhatsApp Cloud API)
  // مثال فقط: طباعة في الكونسول
  console.log(`[WHATSAPP OTP] لجوال ${phone} -- كود التحقق: ${code}`);
}

module.exports = router;
