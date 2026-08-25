const { z } = require("zod");

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");
const timeText = z.string().min(3).max(20);

const contactSchema = z
  .object({
    name: z.string().max(120).optional(),
    phone: z.string().max(30).optional(),
    email: z.string().email().optional().or(z.literal("")),
  })
  .optional();

const geoSchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .optional();

const createCenterSchema = z.object({
  centerCode: z.string().min(2).max(30),
  name: z.string().min(3).max(200),
  addressLine1: z.string().min(3).max(300),
  addressLine2: z.string().max(300).optional(),
  landmark: z.string().max(200).optional(),
  city: z.string().min(2).max(120),
  district: z.string().min(2).max(120),
  state: z.string().min(2).max(120),
  pincode: z.string().min(4).max(12),
  contact: contactSchema,
  geo: geoSchema,
  active: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

const updateCenterSchema = createCenterSchema.partial();

const createRoomSchema = z.object({
  roomCode: z.string().min(1).max(30),
  roomName: z.string().min(1).max(120),
  block: z.string().max(80).optional(),
  floor: z.string().max(40).optional(),
  capacity: z.number().int().min(1).max(10000),
  usableCapacity: z.number().int().min(1).max(10000).optional(),
  seatPrefix: z.string().max(20).optional(),
  active: z.boolean().optional(),
  accessibility: z
    .object({
      wheelchairAccess: z.boolean().optional(),
      groundFloor: z.boolean().optional(),
    })
    .optional(),
});

const updateRoomSchema = createRoomSchema.partial();

const paperSchema = z.object({
  paperCode: z.string().max(40).optional(),
  name: z.string().min(1).max(120),
  numberOfQuestions: z.number().int().min(1).max(1000),
  durationMinutes: z.number().int().min(1).max(1000).optional(),
  order: z.number().int().min(1).optional(),
});

const instructionSchema = z.object({
  order: z.number().int().min(1),
  text: z.string().min(3).max(1000),
});

const createScheduleSchema = z.object({
  projectId: objectId.optional(),
  jobId: objectId,
  examName: z.string().min(3).max(200),
  examCode: z.string().min(2).max(40),
  commissionName: z.string().max(200).optional(),
  commissionNameLocal: z.string().max(200).optional(),
  advertisementNo: z.string().max(80).optional(),
  shiftName: z.string().max(80).optional(),
  examDate: z.string().min(1),
  reportingTime: timeText,
  gateClosingTime: timeText,
  examStartTime: timeText,
  examEndTime: timeText.optional(),
  timezone: z.string().max(60).optional(),
  rollNumberPrefix: z.string().max(20).optional(),
  rollNumberStart: z.number().int().min(1).optional(),
  rollNumberPadding: z.number().int().min(3).max(12).optional(),
  papers: z.array(paperSchema).min(1),
  instructions: z.array(instructionSchema).optional(),
  provisionalNote: z.string().max(1000).optional(),
  selectedCenterIds: z.array(objectId).min(1, "Select at least one exam center"),
  admitCardTemplate: z.string().optional(),
  attendanceSheetTemplate: z.string().optional(),
  admitCardLogoUrl: z.string().url("Must be a valid URL").optional().or(z.literal('')),
});

const updateScheduleSchema = createScheduleSchema
  .partial()
  .extend({
    status: z
      .enum(["draft", "allocation_ready", "allocated", "locked", "published", "cancelled"])
      .optional(),
  });

const allocationOptionsSchema = z.object({
  centerIds: z.array(objectId).optional(),
  allowPartial: z.boolean().optional(),
});

module.exports = {
  createCenterSchema,
  updateCenterSchema,
  createRoomSchema,
  updateRoomSchema,
  createScheduleSchema,
  updateScheduleSchema,
  allocationOptionsSchema,
};
