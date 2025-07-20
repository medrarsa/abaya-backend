const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const OrderItemStep = require('../models/OrderItemStep');
const Employee = require('../models/Employee');
const Goal = require('../models/Goal'); // تحتاج تجهز موديل Goal بسيط إذا ما كان عندك

// احصائيات الشهر
router.get('/monthly-summary', async (req, res) => {
  try {
    const { year, month } = req.query;
    const yearNum = Number(year);
    const monthNum = Number(month);
    const start = new Date(yearNum, monthNum - 1, 1);
    const end = new Date(yearNum, monthNum, 1);

    // عدد العملاء
    const customersCount = await Order.countDocuments({
      createdAt: { $gte: start, $lt: end }
    });

    // عدد الطلبات (عدد OrderItemStep داخل الشهر)
    const salesCount = await OrderItemStep.countDocuments({
      receivedAt: { $gte: start, $lt: end }
    });

    // عدد الطلبات المكتملة (مرحلة شحن أو اسمها "شحن")
    const shippedOrdersCount = await OrderItemStep.countDocuments({
      stepName: "موظف الشحن",
      receivedAt: { $gte: start, $lt: end }
    });

    // الهدف (من جدول Goal)
    let goalDoc = await Goal.findOne({ year: yearNum, month: monthNum });
    let goal = goalDoc ? goalDoc.goal : 0;

    res.json({ customersCount, salesCount, shippedOrdersCount, goal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// بيانات المخطط البياني اليومي
router.get('/daily-shipments', async (req, res) => {
  try {
    const { year, month } = req.query;
    const yearNum = Number(year);
    const monthNum = Number(month);

    // عدد الأيام في الشهر (30 أو 31 أو 28 أو 29)
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const data = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const from = new Date(yearNum, monthNum - 1, day, 0, 0, 0);
      const to = new Date(yearNum, monthNum - 1, day, 23, 59, 59);

      // عدد الشحنات التي خرجت في هذا اليوم (اسم المرحلة "شحن")
      const shipped = await OrderItemStep.countDocuments({
        stepName: "موظف الشحن",
        receivedAt: { $gte: from, $lte: to }
      });

      data.push({ day, shipped });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// أحدث الأحداث (آخر 20 حركة)
router.get('/latest-events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "20");
    const items = await OrderItemStep.find({})
      .sort({ receivedAt: -1 })
      .limit(limit)
      .populate("employee")
      .populate({
        path: "orderItem",
        populate: { path: "order" }
      });
    const arr = items.map(i => ({
      stepName: i.stepName,
      employee: i.employee ? i.employee.name : "-",
      orderNumber: i.orderItem?.order?.orderNumber || "-",
      date: i.receivedAt ? timeAgo(i.receivedAt) : ""
    }));
    res.json(arr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// الموظفين الموقوفين
router.get('/blocked-staff', async (req, res) => {
  try {
    const staff = await Employee.find({ status: "موقوف" });
    res.json(staff.map(e => ({ name: e.name, jobType: e.jobType })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// أحدث الطلبات المنجزة (مرحلة "شحن")
router.get('/latest-shipped-orders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "20");
    const items = await OrderItemStep.find({ stepName: "موظف الشحن" })
      .sort({ receivedAt: -1 })
      .limit(limit)
      .populate({
        path: "orderItem",
        populate: [{ path: "order" }]
      });
    const arr = items.map(i => ({
      orderNumber: i.orderItem?.order?.orderNumber || "-",
      customer: i.orderItem?.order?.customer || "-",
      shippedAt: i.receivedAt ? timeAgo(i.receivedAt) : ""
    }));
    res.json(arr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة أو تحديث الهدف الشهري
router.post('/goal', async (req, res) => {
  try {
    const { year, month, value } = req.body;
    if (!year || !month || value == null) return res.status(400).json({ error: "البيانات ناقصة" });

    // تحديث أو إضافة جديد
    const goal = await Goal.findOneAndUpdate(
      { year, month },
      { value },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب الهدف الشهري
router.get('/goal', async (req, res) => {
  try {
    const { year, month } = req.query;
    const goal = await Goal.findOne({ year, month });
    res.json(goal || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


function timeAgo(date) {
  // دالة بسيطة ترجع نص مثل: قبل دقيقة، قبل ساعة، قبل يوم ...
  const now = new Date();
  const d = new Date(date);
  const diff = (now - d) / 1000; // بالثواني
  if (diff < 60) return "قبل دقيقة";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 172800) return "أمس";
  return d.toLocaleDateString("ar-EG");
}

module.exports = router;
