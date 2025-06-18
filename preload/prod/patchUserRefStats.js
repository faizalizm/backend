const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv').config({path: path.join(__dirname, '..', '..', '.env')});
const colors = require('colors');

const {connectDB} = require('../../services/mongodb');
const Member = require('../../models/memberModel'); // adjust path as needed

// Connect to the database
connectDB();

(async () => {
  try {
    console.log('🚀 Starting patch referral statistics process...'.blue);

    const allMembers = await Member.find({}, '_id fullName').lean();
    console.log(`🧮 Total members: ${allMembers.length}`);

    for (const [index, member] of allMembers.entries()) {
      const summary = Array.from({ length: 20 }, (_, i) => ({
        level: i + 1,
        vip: 0,
        user: 0
      }));

      let currentLevelIds = [member._id];

      for (let level = 1; level <= 20 && currentLevelIds.length > 0; level++) {
        const downlines = await Member.find({
          referredBy: { $in: currentLevelIds }
        }, '_id type');

        if (!downlines.length) break;

        const vipCount = downlines.filter(m => m.type === 'VIP').length;
        const userCount = downlines.length - vipCount;

        summary[level - 1].vip = vipCount;
        summary[level - 1].user = userCount;

        currentLevelIds = downlines.map(m => m._id);
      }

      await Member.updateOne(
        { _id: member._id },
        { referralStats: summary }
      );

      console.log(`✅ Updated member ${index + 1}/${allMembers.length}, ID: (${member._id}), FN: (${member.fullName})`);
    }

    console.log('🎉 All referral stats updated.');
  } catch (error) {
    console.error('❌ Error patching :', error.message);
  } finally {
    process.exit(); // Exit the script when done
}
})();
