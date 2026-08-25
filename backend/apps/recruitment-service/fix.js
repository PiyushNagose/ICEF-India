const mongoose = require('mongoose');
const Job = require('./src/shared/models/Job.js');

mongoose.connect('mongodb+srv://piyushnagose204_db_user:Piyush123@cluster0.vdxs1vc.mongodb.net/recruitment_portal?retryWrites=true&w=majority')
  .then(async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const res = await Job.updateMany(
      { status: 'closed', applicationDeadline: { $gte: startOfToday } },
      { $set: { status: 'active' } }
    );
    console.log('Updated:', res.modifiedCount);
    process.exit(0);
  })
  .catch(console.error);
