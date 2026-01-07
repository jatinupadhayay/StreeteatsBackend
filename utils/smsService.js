const axios = require("axios");

/**
 * SMS Service to handle real SMS delivery
 * Currently supports a "Mock" mode and a "Fast2SMS" implementation (popular in India)
 */
const sendOTP = async (phone, otp) => {
    try {
        // If we have an API key, we use a real provider
        const Fast2SMS_API_KEY = process.env.FAST2SMS_API_KEY;

        if (Fast2SMS_API_KEY) {
            console.log("SMS Service: API Key detected. Attempting real SMS...");
            // Real implementation using Fast2SMS
            const useV3Fallback = process.env.FAST2SMS_USE_V3 === 'true';

            const payload = useV3Fallback ? {
                "route": "v3",
                "sender_id": "FT2SMS",
                "message": `Your Street Eats verification code is: ${otp}`,
                "numbers": String(phone),
            } : {
                "variables_values": String(otp),
                "route": "otp",
                "numbers": String(phone),
            };

            console.log(`SMS Service: Sending Payload (${useV3Fallback ? 'v3' : 'otp'} route):`, JSON.stringify(payload));

            const options = {
                method: 'POST',
                url: 'https://www.fast2sms.com/dev/bulkV2',
                headers: {
                    "authorization": Fast2SMS_API_KEY.trim(),
                    "Content-Type": "application/json"
                },
                data: payload
            };

            const response = await axios(options);
            console.log("SMS Service: Fast2SMS Response:", response.data);
            return { ...response.data, mode: "real" };
        } else {
            // MOCK MODE: Log to console if no API Key is provided
            console.log(`\n--- [MOCK SMS MODE] ---`);
            console.log(`NOTICE: No FAST2SMS_API_KEY found in .env`);
            console.log(`To: ${phone}`);
            console.log(`Message: ${otp}`);
            console.log(`------------------------\n`);
            return { success: true, message: "Mock SMS logged to console", mode: "mock" };
        }
    } catch (error) {
        console.error("SMS Service Error:", error.message);
        if (error.response) {
            console.error("Fast2SMS Error Details:", JSON.stringify(error.response.data, null, 2));
        }
        // In dev, we don't want to crash the request if SMS fails
        return { success: false, error: error.message, details: error.response?.data };
    }
};

module.exports = { sendOTP };
