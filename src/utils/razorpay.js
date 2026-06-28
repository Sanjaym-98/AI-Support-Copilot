const Razorpay = require("razorpay");

let instance = new Razorpay({
    key_id:process.env.RAZORPAY_API_KEY,
    key_secret:process.env.RAZORPAY_SECRET_KEY
})


module.exports = instance