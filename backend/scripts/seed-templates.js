const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const admitCardTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    baseLayout: { type: String, enum: ['standard', 'modern', 'compact'], required: true, default: 'standard' },
    logoUrl: { type: String, trim: true, default: '' },
    watermarkUrl: { type: String, trim: true, default: '' },
    primaryColor: { type: String, trim: true, default: '#f97316' },
    isSystemDefault: { type: Boolean, default: false },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    instructions: { type: String, default: '' }
  },
  { timestamps: true }
);

const AdmitCardTemplate = mongoose.model('AdmitCardTemplate', admitCardTemplateSchema);

const seedTemplates = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI is not defined in .env");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const defaultTemplates = [
      {
        name: "Standard",
        baseLayout: "standard",
        primaryColor: "#f97316",
        isSystemDefault: true,
        instructions: "",
      },
      {
        name: "Modern",
        baseLayout: "modern",
        primaryColor: "#f97316",
        isSystemDefault: true,
        instructions: "",
      },
      {
        name: "Compact",
        baseLayout: "compact",
        primaryColor: "#f97316",
        isSystemDefault: true,
        instructions: "",
      }
    ];

    console.log("Seeding templates...");
    
    for (const template of defaultTemplates) {
      const existing = await AdmitCardTemplate.findOne({ name: template.name });
      if (!existing) {
        await AdmitCardTemplate.create(template);
        console.log(`Created template: ${template.name}`);
      } else {
        console.log(`Template ${template.name} already exists.`);
      }
    }

    console.log("Templates seeded successfully!");
    mongoose.connection.close();
  } catch (error) {
    console.error("Failed to seed templates:", error);
    mongoose.connection.close();
    process.exit(1);
  }
};

seedTemplates();
