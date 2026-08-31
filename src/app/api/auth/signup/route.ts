import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import getDb from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const pool = getDb();
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    // Get or create a default tenant for the sake of signup
    let tenantId = 'default-tenant';
    const tenantCheck = await pool.query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
    
    if (tenantCheck.rows.length === 0) {
      await pool.query(
        'INSERT INTO tenants (id, name, config) VALUES ($1, $2, $3)',
        [tenantId, 'Default Tenant', '{}']
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = uuidv4();

    await pool.query(
      `INSERT INTO users (id, tenant_id, email, name, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, tenantId, email, name, passwordHash, 'admin']
    );

    // Log signup audit event to Supabase
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
      await pool.query(
        `INSERT INTO audit_events (id, tenant_id, actor, action, entity_type, entity_id, details_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), tenantId, email, 'user_signup', 'user', userId, JSON.stringify({ name, ip: ipAddress, userAgent })]
      );
    } catch (auditErr) {
      console.error('Failed to log signup audit event:', auditErr);
      // Don't block signup if audit logging fails
    }

    return NextResponse.json({ success: true, message: 'User created successfully' });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
