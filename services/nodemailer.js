const nodemailer = require('nodemailer');

const {logger} = require('./logger');

const sendMail = async (mailId, subject, htmlContent, recipientEmail) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_NOREPLY,
                pass: process.env.EMAIL_PWD
            }
        });

        const to = recipientEmail || process.env.EMAIL_ADMIN; // Use recipientEmail if provided, otherwise default to admin email
        const replyTo = process.env.EMAIL_ADMIN;

        await transporter.sendMail({
            from: process.env.EMAIL_NOREPLY,
            to,
            replyTo,
            subject,
            html: htmlContent,
            messageId: `rewardhub-${mailId}-${Date.now()}@gmail.com`,
            headers: {
                'X-Priority': '1',
                'X-Mailer': 'Nodemailer'
            }
        });

        logger.info('Email sent successfully');

        return true;
    } catch (error) {
        logger.error('Failed to send email:', error);
    }
    return false;
};

module.exports = {sendMail};