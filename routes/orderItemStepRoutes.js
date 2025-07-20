const express = require('express');
const router = express.Router();
const OrderItemStep = require('../models/OrderItemStep');
const Stage = require('../models/Stage');
const Employee = require('../models/Employee');
const OrderItem = require('../models/OrderItem');
const AbayaModel = require('../models/AbayaModel');
const Fabric = require('../models/Fabric');
const FabricLog = require('../models/FabricLog');
const Payment = require('../models/Payment'); // أضف استيراد payments هنا

// جلب جميع OrderItems مع فلترة حسب المجموعة/التاريخ
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.query.groupDate) query.groupDate = req.query.groupDate;
    if (req.query.groupNumber) query.groupNumber = req.query.groupNumber;
    const items = await OrderItem.find(query);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة مرحلة جديدة لقطعة (استلام أو تسليم مرحلة)
router.post('/', async (req, res) => {
  try {
    let { orderItem, stepName, employee } = req.body;

    // جلب الـ ObjectId الحقيقي للقطعة إذا تم إرسال barcode أو ObjectId نصي
    let itemObj = null;
    if (orderItem && typeof orderItem === "string" && orderItem.length === 24 && /^[a-fA-F0-9]+$/.test(orderItem)) {
      itemObj = await OrderItem.findById(orderItem);
      if (!itemObj) itemObj = await OrderItem.findOne({ barcode: orderItem });
    } else {
      itemObj = await OrderItem.findOne({ barcode: orderItem });
    }
    if (!itemObj) return res.status(400).json({ error: "القطعة غير موجودة." });
    orderItem = itemObj._id;

    // جلب جميع المراحل مرتبة
    const stages = await Stage.find().sort({ order: 1 });
    const currentStage = stages.find(s => s.name === stepName);

    if (!currentStage) {
      return res.status(400).json({ error: "المرحلة غير معرفة في قاعدة البيانات." });
    }

    // جلب الموديل - بحث ذكي (ObjectId أو code)
    let abayaModel = null;
    if (typeof itemObj.model === "string" && itemObj.model.length === 24 && /^[a-fA-F0-9]+$/.test(itemObj.model)) {
      abayaModel = await AbayaModel.findById(itemObj.model);
    } else if (typeof itemObj.model === "string") {
      abayaModel = await AbayaModel.findOne({ code: itemObj.model });
    }

    // استخراج قائمة المراحل المطلوبة فعليًا (يتخطى المطرز لو embPrice=0)
    let requiredStages = stages.filter(stage => {
      if (stage.name === "مطرز" && (!abayaModel || Number(abayaModel.embPrice) === 0)) return false;
      return true;
    });

    // تحقق من نوع الموظف
    const emp = await Employee.findById(employee);
    if (!emp || emp.jobType !== currentStage.jobType) {
      return res.status(400).json({ error: `الموظف ليس من نوع التخصص المطلوب (${currentStage.jobType}) لهذه المرحلة.` });
    }

    // تحقق من المراحل السابقة للقطعة (بناءً على requiredStages)
    const steps = await OrderItemStep.find({ orderItem }).sort({ receivedAt: 1 });

    // تحقق إذا المرحلة الحالية منفذة سابقًا (يمنع تكرار التنفيذ)
    if (steps.some(s => s.stepName === stepName && s.status === "منجز")) {
      const stepObj = steps.find(s => s.stepName === stepName && s.status === "منجز");
      const index = requiredStages.findIndex(s => s.name === stepName);
      const nextStage = requiredStages[index + 1];
      return res.status(400).json({
        error: `ℹ️لقد تم تنفيذ طلب ${stepName} لهذا الطلب. تم تنفيذ مرحلة "${stepName}" في تاريخ ${stepObj.receivedAt ? new Date(stepObj.receivedAt).toLocaleString('ar-EG') : '-'}.${nextStage ? ` المرحلة التالية للطلب هي "${nextStage.name}".` : ""}`
      });
    }

    if (steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      const currentIndex = requiredStages.findIndex(s => s.name === stepName);
      const lastIndex = requiredStages.findIndex(s => s.name === lastStep.stepName);

      if (currentIndex !== lastIndex + 1) {
        const nextStage = requiredStages[lastIndex + 1];
        return res.status(400).json({
          error: `تم تنفيذ مرحلة "${lastStep.stepName}" في تاريخ ${lastStep.receivedAt ? new Date(lastStep.receivedAt).toLocaleString('ar-EG') : '-'}.
المرحلة التالية للطلب هي "${nextStage?.name || 'لا يوجد'}".`
        });
      }

      // المرحلة السابقة يجب أن تكون "منجزة"
      if (lastStep.status !== 'منجز') {
        return res.status(400).json({
          error: `يجب إنهاء المرحلة السابقة أولاً (${lastStep.stepName})`
        });
      }
    }

    // ====== خصم القماش وتسجيل الحركة تلقائياً عند تنفيذ مرحلة "قص" أو "قصاص" ======
    if (stepName === "قص" || stepName === "قصاص") {
      // هنا الذكاء: إذا itemObj.fabric كود أو ObjectId
      let fabric;
      if (typeof itemObj.fabric === "string" && itemObj.fabric.length === 24 && /^[a-fA-F0-9]+$/.test(itemObj.fabric)) {
        fabric = await Fabric.findById(itemObj.fabric);
      } else {
        fabric = await Fabric.findOne({ code: itemObj.fabric });
      }

      if (!abayaModel || !fabric) {
        return res.status(400).json({ error: "بيانات الموديل أو القماش غير مكتملة." });
      }
      if (fabric.currentStock < abayaModel.metersNeeded) {
        return res.status(400).json({ error: "لا يوجد كمية كافية من القماش في المخزون!" });
      }
      fabric.currentStock -= abayaModel.metersNeeded;
      await fabric.save();

      // سجل حركة FabricLog
      try {
        const fabricLogDoc = await FabricLog.create({
          fabric: fabric._id,
          type: "out",
          qty: abayaModel.metersNeeded,
          orderItem: itemObj._id,
          employeeUsername: emp.username || "",
          note: "خصم تلقائي عند تنفيذ القص",
          cost: fabric.unitPrice,
          createdAt: new Date()
        });
        console.log('تم تسجيل FabricLog:', fabricLogDoc);
      } catch (e) {
        console.error('خطأ عند تسجيل FabricLog:', e);
      }
    }
    // =========================================================

    // إضافة المرحلة (مع تسجيل السعر)
    const step = new OrderItemStep({
      orderItem,
      stepName,
      employee,
      status: "منجز",
      amount: req.body.amount,
      receivedAt: new Date(),
      notes: req.body.notes || ""
    });
    await step.save();

    // ====== إضافة مستحق مالي تلقائي ======
    try {
      await Payment.create({
        employee: employee,
        amount: req.body.amount,
        type: "مستحق",
        orderItem: orderItem,
        stepName: stepName,
        status: "pending",
        notes: "مستحق تلقائي من تنفيذ مرحلة " + stepName
      });
      console.log('تم تسجيل المستحق في Payment تلقائيًا.');
    } catch (e) {
      console.error('خطأ عند تسجيل المستحق في Payment:', e);
    }
    // =======================================

    res.status(201).json(step);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// جلب جميع مراحل القطعة
router.get('/byOrderItem/:orderItemId', async (req, res) => {
  try {
    const steps = await OrderItemStep.find({ orderItem: req.params.orderItemId })
      .populate('employee');
    res.json(steps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// جلب كل القطع التي استلمها موظف معين في أي مرحلة
router.get('/by-employee/:employeeId', async (req, res) => {
  try {
    const steps = await OrderItemStep.find({ employee: req.params.employeeId })
      .populate({
        path: 'orderItem',
        populate: [
          { path: 'model' },
          { path: 'order', populate: { path: 'customer' } }
        ]
      });
    res.json(steps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// كشف مستحقات موظف مع فلترة بالتاريخ
router.get('/salary/:employeeId', async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = { employee: req.params.employeeId, status: "منجز" };
    if (start || end) {
      query.receivedAt = {};
      if (start) query.receivedAt.$gte = new Date(start);
      if (end) query.receivedAt.$lte = new Date(end);
    }
    const steps = await OrderItemStep.find(query);
    const total = steps.reduce((sum, s) => sum + (s.amount || 0), 0);
    res.json({
      count: steps.length,
      total,
      steps
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// جلب ملخص الطلبات في آخر مرحلة لكل قطعة (للتقارير)
router.get('/stages-summary', async (req, res) => {
  try {
    const match = {};
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
      // ------ التعديل هنا ------
      
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
      {
        $lookup: {
          from: "abayamodels",
          localField: "orderItem.model",
          foreignField: "_id",
          as: "model"
        }
      },
      { $unwind: { path: "$model", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "fabrics",
          localField: "orderItem.fabric",
          foreignField: "_id",
          as: "fabric"
        }
      },
      { $unwind: { path: "$fabric", preserveNullAndEmptyArrays: true } },
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
        $project: {
          _id: "$orderItem._id",
          orderNumber: "$order.orderNumber",
          customer: "$order.customer",
          city: "$order.city",
          groupDate: "$order.groupDate",
          groupNumber: "$order.groupNumber",
          orderDate: "$order.orderDate",
          modelName: "$model.name",
          modelCode: "$model.code",
          fabricType: "$fabric.fabricType",
          fabricName: "$fabric.name",
          metersNeeded: "$model.metersNeeded",
          currentStock: "$fabric.currentStock",
          size: "$orderItem.size",
          notes: "$orderItem.notes",
          barcode: "$orderItem.barcode",
          lastStage: "$lastStep.stepName",
          lastStatus: "$lastStep.status",
          receivedAt: "$lastStep.receivedAt",
          employeeName: "$employee.name",
          employeeUsername: "$employee.username",
          employeeJob: "$employee.jobType",
          employeeAmount: "$lastStep.amount"
        }
      }
    ];
    const data = await OrderItemStep.aggregate(pipeline);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    // 1. جيب بيانات المرحلة قبل الحذف
    const step = await OrderItemStep.findById(req.params.id);
    if (!step) return res.status(404).json({ error: "المرحلة غير موجودة" });

    // 2. حذف سجل حركة المخزون وإرجاع الكمية (مثلاً للقص فقط)
    if (["قص", "قصاص", "قصّ"].includes(step.stepName)) {
      // ابحث عن السجل المرتبط في FabricLog (نوع 'out')
      const fabricLog = await FabricLog.findOne({
        orderItem: step.orderItem,
        type: "out"
      });
      if (fabricLog) {
        // رجع الكمية للمخزون
        await Fabric.findByIdAndUpdate(fabricLog.fabric, { $inc: { currentStock: fabricLog.qty } });
        // احذف سجل الحركة
        await fabricLog.deleteOne();
      }
    }

    // 3. حذف الرصيد المالي للموظف لهذه المرحلة (Payment)
    await Payment.deleteMany({
      orderItem: step.orderItem,
      stepName: step.stepName
    });

    // 4. احذف المرحلة نفسها
    await step.deleteOne();

    res.json({ message: "تم حذف المرحلة وكل الآثار المالية والمخزنية المرتبطة بها." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;
