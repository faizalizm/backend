const nodemailer = require('nodemailer');
const { minify } = require('html-minifier-terser');

const { logger } = require('./logger');

const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465, // or 587
    secure: true,
    // service: 'gmail',
    auth: {
        user: process.env.EMAIL_NOREPLY,
        pass: process.env.EMAIL_PWD
    }
});

const defaultOptions = {
    // from: `"${process.env.EMAIL_NAME}" <${process.env.EMAIL_NOREPLY}>`,
    from: process.env.EMAIL_NOREPLY,
    replyTo: process.env.EMAIL_ADMIN,
    headers: {
        'X-Priority': '1',
        'X-Mailer': 'Nodemailer'
    }
};

const sendMail = async (mailId, subject, htmlContent, recipientEmail, options = {}) => {
    try {
        const to = recipientEmail || process.env.EMAIL_ADMIN; // Use recipientEmail if provided, otherwise default to admin email
        const skipBcc = options.skipBcc || false; // New option to control BCC

        htmlContent = await minify(htmlContent, {
            collapseWhitespace: true,
            removeComments: true,
            minifyCSS: true,
            removeEmptyAttributes: true,
        });

        const htmlSizeInKB = Buffer.byteLength(htmlContent, 'utf8') / 1024;
        logger.info(`Email HTML size: ${htmlSizeInKB.toFixed(2)} KB`);

        const message = {
            ...defaultOptions,
            to,
            subject,
            html: htmlContent,
            messageId: `rewardhub-${mailId}-${Date.now()}@rewardhub.asia`,
        };

        if (!skipBcc && recipientEmail) {
            message.bcc = process.env.EMAIL_ADMIN;
        }

        await transporter.sendMail(message);

        logger.info(`Email sent successfully to ${message.to}${message.bcc ? ' with BCC' : ''}`);

        return true;
    } catch (error) {
        logger.error('Failed to send email:', error);
    }
    return false;
};

module.exports = { sendMail };