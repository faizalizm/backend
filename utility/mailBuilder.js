const fs = require('fs');
const path = require('path');

const { sendMail } = require('../services/nodemailer');

const sendOtpMail = async (email, secureOtp, minutesAfterExpiry) => {
    let mailId = 'secureotp'
    let subject = `RewardHub Secure OTP`

    // Fetch and modify HTML template
    const htmlTemplatePath = path.join(__dirname, '..', 'email', 'otpMail.html');
    let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');

    htmlContent = htmlContent.replace('{{RECIPIENT_NAME}}', `${email} `);
    htmlContent = htmlContent.replace('{{SECURE_OTP}}', `${secureOtp} `);
    htmlContent = htmlContent.replace('{{MINUTE_EXPIRY}}', `${minutesAfterExpiry} `);

    await sendMail(mailId, subject, htmlContent, email);
};

const sendShippingNotification = async (member, transaction) => {
    // Buy via Toyyibpay
    // Fetch and modify HTML template
    const htmlTemplatePath = path.join(__dirname, '..', 'email', 'packageShipping.html');
    let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');

    htmlContent = htmlContent.replace('${packageCode}', `${transaction.packageCode}`);
    htmlContent = htmlContent.replace('${fullName}', `${member.fullName}`);

    htmlContent = htmlContent.replace('${phone}', `${transaction.shippingDetails.phone || ''}`);
    htmlContent = htmlContent.replace('${addressLine1}', `${transaction.shippingDetails.addressLine1}`);
    htmlContent = htmlContent.replace('${addressLine2}', `${transaction.shippingDetails.addressLine2 || ''}`);
    htmlContent = htmlContent.replace('${addressLine3}', `${transaction.shippingDetails.addressLine3 || ''}`);
    htmlContent = htmlContent.replace('${city}', `${transaction.shippingDetails.city}`);
    htmlContent = htmlContent.replace('${state}', `${transaction.shippingDetails.state || ''}`);
    htmlContent = htmlContent.replace('${postCode}', `${transaction.shippingDetails.postCode}`);
    htmlContent = htmlContent.replace('${country}', `${transaction.shippingDetails.country}`);

    let mailId = 'shipping';
    let subject = 'Reward Hub Shipping Notification';
    await sendMail(mailId, subject, htmlContent);
};

const sendShipmentNotification = async (member, logistic, value) => {
    const recipientName =
        member.userName?.trim() ||
        member.fullName?.trim() ||
        member.referralCode;

    let mailId = logistic.systemType.toLowerCase().replace(/\s+/g, '');
    let subject = `RewardHub Order Received – ${logistic.referenceNumber}`

    // Fetch and modify HTML template
    const htmlTemplatePath = path.join(__dirname, '..', 'email', 'shipmentMail.html');
    let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');

    htmlContent = htmlContent.replace('{{MAIL_TITLE}}', `RewardHub Order`);
    htmlContent = htmlContent.replace('{{RECIPIENT_NAME}}', `${recipientName} `);

    htmlContent = htmlContent.replace('{{DATE_TIME}}', `${logistic.createdAt} `);
    htmlContent = htmlContent.replace('{{REF_NUM}}', `${logistic.referenceNumber} `);
    htmlContent = htmlContent.replace('{{ITEM_NAME}}', `${logistic.description} `);
    htmlContent = htmlContent.replace('{{ITEM_PRICE}}', `${value}`);

    const addressLines = [
        logistic.shippingDetails.phone,
        logistic.shippingDetails.addressLine1,
        logistic.shippingDetails.addressLine2,
        logistic.shippingDetails.addressLine3,
        `${logistic.shippingDetails.postCode}, ${logistic.shippingDetails.city}`,
        `${logistic.shippingDetails.state}, ${logistic.shippingDetails.country}.`
    ].filter(Boolean);

    htmlContent = htmlContent.replace('{{ADDRESS_BLOCK}}', addressLines.join(',<br/>'));

    await sendMail(mailId, subject, htmlContent, member.email);
};

module.exports = {
    sendOtpMail,
    sendShippingNotification,
    sendShipmentNotification
};

