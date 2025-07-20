// backend/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const OrderItemStep = require('../models/OrderItemStep');
const bcrypt = require('bcryptjs');

// تسجيل دخول الموظف
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const employee = await Employee.findOne({ username });
  if (!employee) return res.status(400).json({ error: "المستخدم غير موجود" });

  const isMatch = await employee.comparePassword(password);
  if (!isMatch) return res.status(400).json({ error: "كلمة المرور غير صحيحة" });

  // أرسل بيانات الموظف الأساسية، مع username صريح
  res.json({
    id: employee._id,
    username: employee.username,    // <-- أضف هذا السطر
    name: employee.name,
    jobType: employee.jobType, // مدير، خياط، قصاص...
    role: employee.role || null, // إذا فيه حقل role في الداتا
  });
});

// إضافة موظف جديد
router.post('/', async (req, res) => {
  try {
    const employee = new Employee(req.body);
    await employee.save();
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// عرض جميع الموظفين
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// تعديل موظف
// تعديل موظف (مع تشفير كلمة المرور الجديدة فقط عند وجودها)
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (!updateData.password) {
      // لا تعدل الباسوورد إذا لم يكتب
      delete updateData.password;
    } else {
      // إذا كتب باسوورد جديد شفّره هنا (يفترض عندك pre-save في model)
    }
    const updated = await Employee.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// حذف موظف
router.delete('/:id', async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// routes/employees.js أو أي Route رئيسي للموظفين
router.put('/:id/phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: "رقم الجوال غير صحيح" });
    }

    // تحقق: هل الرقم مستخدم بالفعل من موظف آخر؟
    const exists = await Employee.findOne({ phone, _id: { $ne: req.params.id } });
    if (exists) {
      return res.status(400).json({ error: "رقم الجوال مسجل مسبقًا!" });
    }

    // عدل فقط حقل الجوال
    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      { phone },
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// routes/employeeRoutes.js

// تحقق هل الموظف لديه رقم جوال صحيح في الداتا بيز
router.get('/:id/has-phone', async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    // تحقق أن الجوال موجود وصيغته صحيحة (9665xxxxxxxx)
    const phoneOk = emp && emp.phone && /^9665\d{8}$/.test(emp.phone);
    res.json({ hasPhone: !!phoneOk });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// جلب جميع الموظفين مع الحقول المطلوبة فقط
router.get('/summary/list', async (req, res) => {
  try {
    const employees = await Employee.find({}, {
      name: 1,
      phone: 1,
      jobType: 1,
      status: 1,
      username: 1,
      salaryType: 1,
      salaryAmount: 1,
      createdAt: 1
    }).lean();

    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

 

// routes/employeeRoutes.js
router.put('/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "كلمة المرور مطلوبة ويجب أن تكون 4 أحرف على الأقل." });
    }

    // شفر كلمة المرور قبل الحفظ
    const hash = await bcrypt.hash(password, 10);
    const updated = await Employee.findByIdAndUpdate(
      req.params.id,
      { password: hash },
      { new: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



// احسب تاريخ بداية الشهر الحالي ونهايته
 
function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from, to };
}

// لوحة المنافسة الشهرية
router.get('/competition/monthly', async (req, res) => {
  try {
    const { from, to } = getMonthRange();

    // الموظفين الفعّالين فقط (بدون المدراء)
    const employees = await Employee.find({
      status: "فعال",
      jobType: { $ne: "مدير" }
    }).lean();

    // جلب الحركات في هذا الشهر وتجميعها حسب الموظف (توحيد النوع)
    const steps = await OrderItemStep.aggregate([
      { $match: { receivedAt: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: [{ $type: "$employee" }, "objectId"] },
              { $toString: "$employee" },
              "$employee"
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // خريطة employeeId => عدد الحركات
    const stepMap = {};
    steps.forEach(s => { stepMap[s._id] = s.count; });

    // دمج كل الموظفين وعدد حركاتهم (حتى لو صفر)
    const result = employees.map(emp => ({
      _id: emp._id.toString(),
      name: emp.name,
      jobType: emp.jobType,
      phone: emp.phone,
      count: stepMap[emp._id.toString()] || 0
    }));

    // الترتيب النهائي (من الأعلى للأقل)
    result.sort((a, b) => b.count - a.count);

    // أضف الترتيب والسهم (حسب المركز)
    const max = result.length > 0 ? result[0].count : 0;
    const avg = result.reduce((sum, e) => sum + e.count, 0) / (result.length || 1);

 result.forEach((emp, idx) => {
  emp.rank = idx + 1;
  if (emp.count === max && emp.count > 0) emp.trend = "up";             // الأعلى سهم أخضر
  else if (emp.count === 0) emp.trend = "down";                         // عداد صفر سهم أحمر (كسلان)
  else if (emp.count < avg && emp.count > 0) emp.trend = "down";        // أقل من المتوسط سهم أحمر
  else emp.trend = "neutral";                                           // المتوسط سهم رمادي
});


    res.json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
