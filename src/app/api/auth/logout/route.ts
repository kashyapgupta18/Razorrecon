import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import getDb from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_for_development_only_12345'
);

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);

    // Mark session as ended in Supabase
    if (tokenMatch) {
      try {
        const { payload } = await jwtVerify(tokenMatch[1], JWT_SECRET);
        const userId = payload.userId as string;
        if (userId) {
          const pool = getDb();
          await pool.query(
            `UPDATE user_sessions 
             SET logged_out_at = CURRENT_TIMESTAMP, is_active = false 
             WHERE user_id = $1 AND is_active = true`,
            [userId]
          );
        }
      } catch {
        // Token invalid — just clear the cookie
      }
    }

    const response = NextResponse.json({ success: true });

    // Clear the auth cookie
    response.cookies.set({
      name: 'auth_token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
