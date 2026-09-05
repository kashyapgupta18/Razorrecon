
import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export async function GET(req: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);

    const action = searchParams.get('action') || '';
    const entity = searchParams.get('entity') || '';
    const actor = searchParams.get('actor') || '';
    const search = searchParams.get('search') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = `SELECT * FROM audit_events WHERE 1=1`;
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (action) {
      query += ` AND action = $${paramIdx++}`;
      params.push(action);
    }
    if (entity) {
      query += ` AND entity_type = $${paramIdx++}`;
      params.push(entity);
    }
    if (actor) {
      query += ` AND actor = $${paramIdx++}`;
      params.push(actor);
    }
    if (search) {
      query += ` AND (action ILIKE $${paramIdx} OR entity_type ILIKE $${paramIdx} OR actor ILIKE $${paramIdx} OR entity_id ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);
    const result = await db.query(query, params);

    // Get distinct values for filters
    const [actionsRes, entitiesRes, actorsRes] = await Promise.all([
      db.query('SELECT DISTINCT action FROM audit_events ORDER BY action'),
      db.query('SELECT DISTINCT entity_type FROM audit_events ORDER BY entity_type'),
      db.query('SELECT DISTINCT actor FROM audit_events ORDER BY actor'),
    ]);

    return NextResponse.json({
      events: result.rows.map(row => ({
        ...row,
        details: typeof row.details_json === 'string' ? JSON.parse(row.details_json) : row.details_json || {},
      })),
      total,
      filters: {
        actions: actionsRes.rows.map(r => r.action),
        entities: entitiesRes.rows.map(r => r.entity_type),
        actors: actorsRes.rows.map(r => r.actor),
      },
    });
  } catch (error: unknown) {
    console.error('[API] Audit trail error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ events: [], total: 0, filters: { actions: [], entities: [], actors: [] } });
  }
}

