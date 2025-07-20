// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Employee = require('../models/Employee');

// إضافة دفعة جديدة (يدوي من الإدارة)
router.post('/', async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// جلب جميع الحركات/الدفعات/المستحقات لموظف معيّن (الأحدث أولاً)
router.get('/by-employee/:employeeId', async (req, res) => {
  try {
    const { year, month } = req.query;
    let query = { employee: req.params.employeeId };
    if (year && month) {
      const from = new Date(Number(year), Number(month) - 1, 1);
      const to = new Date(Number(year), Number(month), 1);
      query.date = { $gte: from, $lt: to };
    }
    const payments = await Payment.find(query).sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تقرير كشف الرصيد/الحركات مع الفلترة
router.get('/report', async (req, res) => {
  try {
    const { employee, start, end } = req.query;
    let query = {};
    if (employee) query.employee = employee;
    if (start || end) {
      query.date = {};
      if (start) query.date.$gte = new Date(start);
      if (end) query.date.$lte = new Date(end);
    }
    const payments = await Payment.find(query).populate('employee').sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// كشف مستحقات كل موظف (group by)
router.get('/dues-by-employee', async (req, res) => {
  try {
    const result = await Payment.aggregate([
      {
        $group: {
          _id: "$employee",
          due: { $sum: { $cond: [ { $eq: ["$type", "مستحق"] }, "$amount", 0 ] } },
          paid: { $sum: { $cond: [ { $eq: ["$type", "دفعة"] }, "$amount", 0 ] } },
          loan: { $sum: { $cond: [ { $eq: ["$type", "سلفة"] }, "$amount", 0 ] } },
          discount: { $sum: { $cond: [ { $eq: ["$type", "خصم"] }, "$amount", 0 ] } }
        }
      },
      {
        $lookup: {
          from: "employees",
          localField: "_id",
          foreignField: "_id",
          as: "employee"
        }
      },
      { $unwind: "$employee" },
      {
        $project: {
          _id: 0,
          employeeId: "$employee._id",
          name: "$employee.name",
          username: "$employee.username",
          due: 1,
          paid: 1,
          loan: 1,
          discount: 1,
          total: { $subtract: [ { $subtract: [ { $subtract: [ "$due", "$paid" ] }, "$loan" ] }, "$discount" ] }
        }
      }
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
