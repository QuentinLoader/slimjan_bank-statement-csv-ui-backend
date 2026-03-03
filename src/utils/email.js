import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/* ============================
   VERIFY EMAIL
============================ */
export const sendVerificationEmail = async (email, token) => {

  const verificationUrl = `${process.env.APP_URL}/verify-email?token=${token}`;

  await resend.emails.send({
    from: "YouScan <no-reply@addvision.co.za>",
    to: email,
    subject: "Verify your YouScan account",
    html: `
      <h2>Verify Your Email</h2>
      <p>Click the link below to verify your account:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>If you did not register, ignore this email.</p>
    `
  });
};

/* ============================
   PASSWORD RESET
============================ */
export const sendPasswordResetEmail = async (email, token) => {

  const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: "YouScan <no-reply@addvision.co.za>",
    to: email,
    subject: "Reset your YouScan password",
    html: `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `
  });
};