const mongoose = require('mongoose');
require('dotenv').config();

const vendorSchema = new mongoose.Schema({}, { strict: false });
const Vendor = mongoose.model('Vendor', vendorSchema);

async function checkDish() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const searchName = "Bharat";
        const regex = new RegExp(searchName, "i");

        // Find vendors who have a dish matching the name
        const vendors = await Vendor.find({
            "menu": {
                $elemMatch: {
                    $or: [
                        { name: regex },
                        { description: regex }
                    ]
                }
            }
        }).lean();

        console.log(`FOUND ${vendors.length} VENDORS`);

        vendors.forEach(v => {
            console.log(`VENDOR: [${v.shopName}] Status: ${v.status}, Active: ${v.isActive}`);

            const matchingDishes = v.menu.filter(item =>
                regex.test(item.name) || (item.description && regex.test(item.description))
            );

            matchingDishes.forEach(d => {
                console.log(`  - DISH: [${d.name}] Available: ${d.isAvailable}, Price: ${d.price}`);
            });
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkDish();
