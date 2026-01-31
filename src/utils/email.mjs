import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send email notification when audiobook transformation is complete
 * @param {string} bookTitle - The title of the audiobook
 * @param {string} outputPath - Path to the completed audiobook file
 * @param {boolean} success - Whether the transformation was successful
 * @param {string} error - Error message if transformation failed
 */
export async function sendCompletionEmail(
  bookTitle,
  outputPath,
  success = true,
  error = null,
) {
  try {
    // Skip if email is not configured
    if (
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASSWORD ||
      !process.env.EMAIL_TO
    ) {
      console.log("⚠️  Email not configured, skipping notification");
      return;
    }

    const subject = success
      ? `✅ Audiobook Ready: ${bookTitle}`
      : `❌ Audiobook Failed: ${bookTitle}`;

    const htmlContent = success
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff8c42;">🎉 Your Audiobook is Ready!</h2>
          <p>Great news! Your audiobook transformation has completed successfully.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">📚 Book Details</h3>
            <p><strong>Title:</strong> ${bookTitle}</p>
            <p><strong>Output File:</strong> ${outputPath || "Check your done directory"}</p>
          </div>
          
          <p>Your audiobook is ready to listen! 🎧</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">
            This is an automated message from Tanjreen Audiobook Converter
          </p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">❌ Audiobook Transformation Failed</h2>
          <p>Unfortunately, there was an error processing your audiobook.</p>
          
          <div style="background-color: #fff3f3; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <h3 style="margin-top: 0; color: #333;">📚 Book Details</h3>
            <p><strong>Title:</strong> ${bookTitle}</p>
            ${error ? `<p><strong>Error:</strong> ${error}</p>` : ""}
          </div>
          
          <p>Please check the server logs for more details.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">
            This is an automated message from Tanjreen Audiobook Converter
          </p>
        </div>
      `;

    const mailOptions = {
      from: `"Tanjreen 🍊" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    // Don't throw error - email failure shouldn't stop the process
  }
}
