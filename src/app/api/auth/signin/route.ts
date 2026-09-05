import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import getDb from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
});

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_for_development_only_12345'
);

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = limiter.check(5, ip);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const pool = getDb();
    
    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = result.rows[0];

    // Check password
    if (!user.password_hash) {
       return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Generate JWT
    const token = await new SignJWT({ userId: user.id, tenantId: user.tenant_id, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    // Log session to Supabase
    const sessionId = uuidv4();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
      await pool.query(
        `INSERT INTO user_sessions (id, user_id, ip_address, user_agent, logged_in_at, is_active)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, true)`,
        [sessionId, user.id, ipAddress, userAgent]
      );
    } catch (sessionErr) {
      console.error('Failed to log session:', sessionErr);
      // Don't block login if session logging fails
    }

    // Log audit event
    try {
      await pool.query(
        `INSERT INTO audit_events (id, tenant_id, actor, action, entity_type, entity_id, details_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), user.tenant_id, user.email, 'user_signin', 'user', user.id, JSON.stringify({ ip: ipAddress, userAgent })]
      );
    } catch (auditErr) {
      console.error('Failed to log audit event:', auditErr);
    }

    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    
    // Set cookie
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return response;
  } catch (error: unknown) {
    console.error('Signin error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
