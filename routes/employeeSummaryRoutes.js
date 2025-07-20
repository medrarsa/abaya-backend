// routes/employeeSummaryRoutes.js
const express = require('express');
const router = express.Router();
const OrderItemStep = require('../models/OrderItemStep');
const OrderItem = require('../models/OrderItem');
const mongoose = require('mongoose');

router.get('/:employeeId', async (req, res) => {
  try {
    const { from, to } = req.query;
    const employeeId = req.params.employeeId;

    const match = {
      employee: new mongoose.Types.ObjectId(employeeId)
    };
    if (from) match.receivedAt = { $gte: new Date(from) };
    if (to) {
      match.receivedAt = match.receivedAt || {};
      match.receivedAt.$lte = new Date(to + "T23:59:59");
    }

    // 1. جلب كل الحركات المنجزة
    const steps = await OrderItemStep.find({ ...match, status: "منجز" }).lean();

    // 2. عدد الطلبات المنفذة فعلاً
    const totalOrders = steps.length;

    // 3. إجمالي المستحقات
    const totalAmount = steps.reduce((sum, step) => sum + (step.amount || 0), 0);

    // 4. عدد الطلبات لكل يوم (للرسم البياني)
    const dailyStats = {};
    steps.forEach(step => {
      const day = step.receivedAt?.toISOString().slice(0, 10) || "بدون تاريخ";
      dailyStats[day] = (dailyStats[day] || 0) + 1;
    });

    // 5. جلب تفاصيل كل الطلبات (orderitems)
    const orderItemIds = [...new Set(steps.map(s => String(s.orderItem)))];
    const orderItems = await OrderItem.find({ _id: { $in: orderItemIds } })
      .select("model size fabric pieceSequence notes priority") // فقط الحقول المطلوبة
      .lean();

    res.json({
      totalOrders,
      totalAmount,
      dailyStats,
      ordersWorked: orderItems // الآن فيها التفاصيل الكاملة المطلوبة
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
