// backend/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');

 
 
  const OrderItemStep = require('../models/OrderItemStep'); // ضروري: استيراد الموديل هنا
// إضافة طلب جديد (مع قطع)
router.post('/', async (req, res) => {
  try {
    const { customer, status, priority, notes, items } = req.body;
    const order = new Order({ customer, status, priority, notes });
    await order.save();

    const orderItems = await OrderItem.insertMany(
      items.map(item => ({
        ...item,
        order: order._id,
        model: item["رقم الموديل"] || item["code"] || item["model"] // أهم سطر، يرسل رقم الموديل كـ model
      }))
    );

    res.status(201).json({ order, orderItems });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// عرض جميع الطلبات (مع القطع)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find()
      .lean();

    const ordersWithItems = await Promise.all(
      orders.map(async order => {
        const items = await OrderItem.find({ order: order._id });
        return { ...order, items };
      })
    );

    res.json(ordersWithItems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// رفع طلبات متعددة (Bulk Upload) مع بيانات المجموعة
router.post('/bulk-upload', async (req, res) => {
  try {
    const ordersArr = req.body.orders;
    if (!Array.isArray(ordersArr) || ordersArr.length === 0) {
      return res.status(400).json({ error: "لم يتم إرسال أي طلبات." });
    }

    const groupDate = ordersArr[0]?.groupDate || new Date().toISOString().slice(0, 10);
    const groupNumber = ordersArr[0]?.groupNumber || 1;

    // تجميع القطع حسب رقم الطلب
    const ordersMap = {};
    ordersArr.forEach(row => {
      const orderNum = row["رقم الطلب"];
      if (!ordersMap[orderNum]) {
        ordersMap[orderNum] = {
          customerName: row["اسم العميل"],
          city: row["المدينة"],
          date: row["تاريخ الطلب"],
          groupDate: row.groupDate || groupDate,
          groupNumber: row.groupNumber || groupNumber,
          items: []
        };
      }
      ordersMap[orderNum].items.push(row);
    });

    let savedOrders = 0, savedItems = 0;
    for (const [orderNum, orderData] of Object.entries(ordersMap)) {
      const order = new Order({
        customer: orderData.customerName,
        city: orderData.city,
        orderNumber: orderNum,
        orderDate: orderData.date,
        groupDate: orderData.groupDate,
        groupNumber: orderData.groupNumber
      });
      await order.save();

      for (const item of orderData.items) {
        const orderItem = new OrderItem({
          order: order._id,
          model: item["رقم الموديل"] || item["code"] || item["model"], // أهم سطر هنا!
          size: item["المقاس"],
          fabric: item["رقم القماش"] || item["fabricCode"],
          quantity: item["الكمية"],
          notes: item["ملاحظات"],
          status: item["حالة الطلب"],
          priority: item["أولوية"],
          pieceSequence: item["تسلسل القطعة"],
          groupDate: item.groupDate || groupDate,
          groupNumber: item.groupNumber || groupNumber
        });
        await orderItem.save();
        savedItems++;
      }
      savedOrders++;
    }

    res.json({ status: "تم حفظ الطلبات مع بيانات المجموعة!", orders: savedOrders, items: savedItems });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// احضر آخر خطوة (مرحلة) لكل طلب
router.get('/last-stage', async (req, res) => {
  const { from, to } = req.query;
  // اجلب جميع الطلبات ضمن الفترة (إذا تم تحديدها)
  let orderFilter = {};
  if (from) orderFilter.orderDate = { $gte: new Date(from) };
  if (to) {
    orderFilter.orderDate = orderFilter.orderDate || {};
    orderFilter.orderDate.$lte = new Date(to);
  }
  const orders = await Order.find(orderFilter);

  // جلب جميع OrderItemSteps مرة واحدة
  const allSteps = await OrderItemStep.find().sort({ receivedAt: 1 });

  // جهز القوائم
  let result = [];
  for (let order of orders) {
    // جميع القطع لهذا الطلب
    const items = await OrderItem.find({ order: order._id });
    for (let item of items) {
      // خطوات هذه القطعة
      const steps = allSteps.filter(s => s.orderItem.toString() === item._id.toString());
      // آخر خطوة
      const last = steps[steps.length - 1];
      result.push({
        orderNumber: order.orderNumber,
        customer: order.customer,
        lastStage: last ? last.stepName : "جديد",
        lastStatus: last ? last.status : "جديد",
        lastUpdate: last ? last.receivedAt : order.orderDate,
        // أضف أي بيانات إضافية تحتاجها هنا (مثل رقم القطعة أو اسم الموظف)
      });
    }
  }
  res.json(result);
});
router.get('/stages-summary', async (req, res) => {
  try {
    const match = {};
    // فلترة بالتاريخ (اختياري)
    if (req.query.from || req.query.to) {
      match.receivedAt = {};
      if (req.query.from) match.receivedAt.$gte = new Date(req.query.from);
      if (req.query.to) match.receivedAt.$lte = new Date(req.query.to + "T23:59:59");
    }

const pipeline = [
  { $match: match },
  { $sort: { receivedAt: -1 } },
  {
    $group: {
      _id: "$orderItem",
      lastStep: { $first: "$$ROOT" }
    }
  },
  {
    $addFields: {
      orderItemObjId: {
        $cond: [
          {
            $and: [
              { $eq: [ { $type: "$_id" }, "string" ] },
              { $eq: [ { $strLenCP: "$_id" }, 24 ] }
            ]
          },
          { $toObjectId: "$_id" },
          "$_id"
        ]
      }
    }
  },
  {
    $lookup: {
      from: "orderitems",
      localField: "orderItemObjId",
      foreignField: "_id",
      as: "orderItem"
    }
  },
  { $unwind: "$orderItem" },
  {
    $lookup: {
      from: "orders",
      localField: "orderItem.order",
      foreignField: "_id",
      as: "order"
    }
  },
  { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
  // ------ التعديل هنا فقط ------
  {
    $lookup: {
      from: "abayamodels",
      let: { modelValue: "$orderItem.model" },
      pipeline: [
        {
          $match: {
            $expr: {
              $or: [
                { $eq: ["$_id", "$$modelValue"] },       // إذا ObjectId
                { $eq: ["$code", "$$modelValue"] }       // إذا code
              ]
            }
          }
        }
      ],
      as: "model"
    }
  },
  { $unwind: { path: "$model", preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: "fabrics",
      let: { fabricValue: "$orderItem.fabric" },
      pipeline: [
        {
          $match: {
            $expr: {
              $or: [
                { $eq: ["$_id", "$$fabricValue"] },
                { $eq: ["$code", "$$fabricValue"] }
              ]
            }
          }
        }
      ],
      as: "fabric"
    }
  },
  { $unwind: { path: "$fabric", preserveNullAndEmptyArrays: true } },
  // ------ نهاية التعديل ------
  {
    $lookup: {
      from: "employees",
      localField: "lastStep.employee",
      foreignField: "_id",
      as: "employee"
    }
  },
  { $unwind: { path: "$employee", preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: "orderitemsteps",
      let: { orderItemId: "$orderItemObjId" },
      pipeline: [
        { $match: { $expr: { $eq: ["$orderItem", "$$orderItemId"] } } },
        { $sort: { receivedAt: 1 } },
        {
          $lookup: {
            from: "employees",
            localField: "employee",
            foreignField: "_id",
            as: "emp"
          }
        },
        { $unwind: { path: "$emp", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            stage: "$stepName",
            employeeName: "$emp.name",
            amount: 1,
            receivedAt: 1
          }
        }
      ],
      as: "timeline"
    }
  },
  {
    $project: {
      _id: "$orderItem._id",
      orderNumber: "$order.orderNumber",
      customer: "$order.customer",
      city: "$order.city",
      groupDate: "$order.groupDate",
      groupNumber: "$order.groupNumber",
      orderDate: "$order.orderDate",
      modelName: "$model.name",
      modelImage: "$model.imageUrl",
      fabricType: "$fabric.fabricType",
      fabricName: "$fabric.name",
      metersNeeded: "$model.metersNeeded",
      currentStock: "$fabric.currentStock",
        pieceSequence: "$orderItem.pieceSequence", // أضفته هنا فقط
      size: "$orderItem.size",
      notes: "$orderItem.notes",
      barcode: "$orderItem.barcode",
      lastStage: "$lastStep.stepName",
      lastStatus: "$lastStep.status",
      receivedAt: "$lastStep.receivedAt",
      employeeName: "$employee.name",
      employeeUsername: "$employee.username",
      employeeJob: "$employee.jobType",
      employeeAmount: "$lastStep.amount",
      timeline: 1 // هنا الخط الحركي (المصفوفة)
    }
  }
];


    const data = await OrderItemStep.aggregate(pipeline);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// تعديل طلب
router.put('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      req.body, // يستقبل أي حقول تحتاج تعديل: { customer, orderNumber, notes, ... }
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// حذف طلب (مع حذف كل القطع التابعة له)
router.delete('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });

    // احذف كل OrderItems التابعة لهذا الطلب
    await OrderItem.deleteMany({ order: order._id });
    res.json({ message: "تم حذف الطلب وجميع القطع التابعة له" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// حذف جماعي (حسب الفلتر)
router.post('/bulk-delete', async (req, res) => {
  try {
    const { groupDate, groupNumber } = req.body;
    const filter = {};
    if (groupDate) filter.groupDate = groupDate;
    if (groupNumber) filter.groupNumber = groupNumber;
    const orders = await Order.find(filter);

    // احذف كل OrderItems المرتبطة
    const orderIds = orders.map(o => o._id);
    await OrderItem.deleteMany({ order: { $in: orderIds } });

    // احذف الطلبات
    await Order.deleteMany(filter);

    res.json({ message: "تم حذف جميع الطلبات والقطع في الفلتر المحدد", deletedOrders: orderIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
