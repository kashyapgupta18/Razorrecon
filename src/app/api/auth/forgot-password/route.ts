import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import getDb from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const pool = getDb();
    
    // Check if user exists
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // User explicitly requested to return "wrong email id" message if not registered
      return NextResponse.json({ error: 'wrong email id' }, { status: 404 });
    }

    const userId = result.rows[0].id;

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

    // In a real application, you would send this OTP via an email provider (e.g. SendGrid, Resend)
    // Since we don't have an email provider configured, we are simulating this by returning the OTP
    // so the frontend can display it in a toast for demo purposes.
    
    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully',
      simulatedOtp: otp // Note: FOR DEMO ONLY. Remove in production!
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
