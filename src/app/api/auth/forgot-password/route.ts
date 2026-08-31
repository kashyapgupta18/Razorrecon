import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import getDb from '@/lib/db';

import sgMail from '@sendgrid/mail';

// Make sure to initialize the API key if it exists in the environment
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const pool = getDb();
    
    // Check if user exists
    const result = await pool.query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // User explicitly requested to return "wrong email id" message if not registered
      return NextResponse.json({ error: 'wrong email id' }, { status: 404 });
    }

    const { id: userId, name: userName } = result.rows[0];

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Valid for 15 minutes

    const resetId = uuidv4();

    await pool.query(
      `INSERT INTO password_resets (id, user_id, otp, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [resetId, userId, otp, expiresAt]
    );

    // Send the email via SendGrid
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
       console.error("Missing SendGrid environment variables (SENDGRID_API_KEY or SENDGRID_FROM_EMAIL). OTP not sent.");
       return NextResponse.json({ error: 'Email service is not configured properly.' }, { status: 500 });
    }

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL, 
      subject: 'Your Password Reset OTP - RazorRecon AI',
      text: `Hello ${userName},\n\nYour OTP for resetting your password is: ${otp}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${userName},</p>
          <p>We received a request to reset your password. Use the following OTP to complete the process:</p>
          <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #4f46e5;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 14px;">This code will expire in 15 minutes.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
    };

    await sgMail.send(msg);
    
    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully to your email.'
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
