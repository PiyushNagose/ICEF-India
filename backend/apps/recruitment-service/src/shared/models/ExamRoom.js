const mongoose = require("mongoose");

const examRoomSchema = new mongoose.Schema(
  {
    centerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamCenter",
      required: true,
    },
    roomCode: { type: String, required: true, uppercase: true, trim: true },
    roomName: { type: String, required: true, trim: true },
    block: { type: String, trim: true },
    floor: { type: String, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    usableCapacity: { type: Number, min: 1 },
    seatPrefix: { type: String, trim: true },
    active: { type: Boolean, default: true },
    accessibility: {
      wheelchairAccess: { type: Boolean, default: false },
      groundFloor: { type: Boolean, default: false },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true },
);

examRoomSchema.pre("validate", function setUsableCapacity(next) {
  if (!this.usableCapacity) this.usableCapacity = this.capacity;
  next();
});

examRoomSchema.index({ centerId: 1, roomCode: 1 }, { unique: true });
examRoomSchema.index({ centerId: 1, active: 1 });

module.exports = mongoose.model("ExamRoom", examRoomSchema);
