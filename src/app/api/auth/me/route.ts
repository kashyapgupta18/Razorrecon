import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import getDb from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_for_development_only_12345'
);

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);

    if (!tokenMatch) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const token = tokenMatch[1];

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as string;

    if (!userId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const pool = getDb();
    const result = await pool.query(
      'SELECT id, name, email, role, tenant_id, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = result.rows[0];
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        createdAt: user.created_at,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
