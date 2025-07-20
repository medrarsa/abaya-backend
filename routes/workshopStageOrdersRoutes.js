// backend/routes/workshopStageOrdersRoutes.js
const express = require('express');
const router = express.Router();
const OrderItem = require('../models/OrderItem');

router.get('/for-stage/:jobType', async (req, res) => {
  const jobType = req.params.jobType;

  let prevStage = null;
  if (jobType === "مطرز") prevStage = "قصاص";
  if (jobType === "خياط") prevStage = "مطرز";
  if (jobType === "كواية") prevStage = "خياط";
  if (jobType === "مركب أزرار") prevStage = "كواية";
  if (jobType === "موظف الشحن") prevStage = "مركب أزرار";

  try {
    let pipeline = [
      {
        $lookup: {
          from: "orderitemsteps",
          localField: "_id",
          foreignField: "orderItem",
          as: "steps"
        }
      },
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderData"
        }
      },
      { $unwind: { path: "$orderData", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "abayamodels",
          localField: "model",
          foreignField: "code",
          as: "modelData"
        }
      },
      { $unwind: { path: "$modelData", preserveNullAndEmptyArrays: true } },
    ];

    if (jobType === "مطرز") {
      pipeline.push(
        { $match: { "steps.stepName": { $ne: "مطرز" }, "steps.stepName": "قصاص", "modelData.embPrice": { $gt: 0 } } }
      );
    } else if (jobType === "خياط") {
      pipeline.push({
        $match: {
          "steps.stepName": { $ne: "خياط" },
          $or: [
            { "modelData.embPrice": { $gt: 0 }, "steps.stepName": "مطرز" },
            { "modelData.embPrice": 0, "steps.stepName": "قصاص" }
          ]
        }
      });
    } else {
      let match = { "steps.stepName": { $ne: jobType } };
      if (prevStage) match["steps.stepName"] = prevStage;
      pipeline.push({ $match: match });
    }

    // هنا حدد الحقول المطلوبة للعرض
    pipeline.push({
      $project: {
        _id: 1,
        orderNumber: "$orderData.orderNumber",
        size: 1,
        fabric: 1,
        priority: 1,
        // باقي الحقول اللي تحتاجها ممكن تضيفها هنا
      }
    });

    const items = await OrderItem.aggregate(pipeline);
    res.json(items);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
