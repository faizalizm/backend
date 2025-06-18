const fs = require('fs');
const path = require('path');

const { sendMail } = require('../services/nodemailer');

const sendShippingNotification = async (member, transaction) => {
    // Fetch and modify HTML template
    const htmlTemplatePath = path.join(__dirname, '..', 'email', 'packageShipping.html');
    let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf-8');

    htmlContent = htmlContent.replace('${packageCode}', `${transaction.packageCode}`);
    htmlContent = htmlContent.replace('${fullName}', `${member.fullName}`);

    htmlContent = htmlContent.replace('${phone}', `${transaction.shippingDetails.phone}`);
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

module.exports = {
    sendShippingNotification,
};

