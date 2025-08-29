
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

const app = express();
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || '*'; // set to your site origin in prod

app.use(cors({ origin: ORIGIN }));
app.use(express.json({ limit: '1mb' }));

// --- DB setup ---
const db = new Database('./qr_cards.sqlite');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firstName TEXT, lastName TEXT, title TEXT, company TEXT,
  email TEXT, mobile TEXT, workPhone TEXT, website TEXT,
  socials_json TEXT, address_json TEXT, notes TEXT,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contactId INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  isPublic INTEGER DEFAULT 1,
  viewCount INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now')), updatedAt TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contactId INTEGER NOT NULL,
  consentText TEXT,
  consentVersion TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE CASCADE
);
`);

// --- Helpers ---
function sanitizeUrl(u) {
  if (!u) return '';
  try { const url = new URL(u); return url.toString(); } catch { return ''; }
}

function buildVCard(contact){
  const esc = (s)=> (s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const adr = contact.address || {};
  const lines = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    `N:${esc(contact.lastName)};${esc(contact.firstName)};;;`,
    `FN:${esc((contact.firstName||'') + ' ' + (contact.lastName||''))}`,
    contact.company ? `ORG:${esc(contact.company)}` : '',
    contact.title ? `TITLE:${esc(contact.title)}` : '',
    contact.email ? `EMAIL;TYPE=work:${esc(contact.email)}` : '',
    contact.mobile ? `TEL;TYPE=cell,voice:${esc(contact.mobile)}` : '',
    contact.workPhone ? `TEL;TYPE=work,voice:${esc(contact.workPhone)}` : '',
    contact.website ? `URL:${esc(contact.website)}` : '',
    (adr.street || adr.city || adr.state || adr.postal || adr.country)
      ? `ADR;TYPE=work:;;${esc(adr.street)};${esc(adr.city)};${esc(adr.state)};${esc(adr.postal)};${esc(adr.country)}`
      : '',
    contact.notes ? `NOTE:${esc(contact.notes)}` : '',
    'END:VCARD',
  ].filter(Boolean);
  return lines.join('\r\n');
}

// --- Routes ---

// Create contact + profile (basic validation)
app.post('/api/qr-cards', (req, res) => {
  try {
    const { contact, consent, qr } = req.body || {};
    if (!contact?.firstName || !contact?.lastName || !contact?.email || !contact?.mobile) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Normalize a few fields
    contact.website = sanitizeUrl(contact.website);
    const socials = contact.socials || {};
    Object.keys(socials).forEach(k => socials[k] = sanitizeUrl(socials[k]));

    // Insert contact
    const stmt = db.prepare(`INSERT INTO contacts 
      (firstName, lastName, title, company, email, mobile, workPhone, website, socials_json, address_json, notes)
      VALUES (@firstName, @lastName, @title, @company, @email, @mobile, @workPhone, @website, @socials_json, @address_json, @notes)`);
    const info = stmt.run({
      firstName: contact.firstName, lastName: contact.lastName, title: contact.title || '', company: contact.company || '',
      email: contact.email, mobile: contact.mobile, workPhone: contact.workPhone || '', website: contact.website || '',
      socials_json: JSON.stringify(socials),
      address_json: JSON.stringify(contact.address || {}),
      notes: contact.notes || ''
    });
    const contactId = info.lastInsertRowid;

    // Profile slug
    const slug = nanoid();
    db.prepare(`INSERT INTO profiles (contactId, slug) VALUES (?, ?)`).run(contactId, slug);

    // Consent record
    const cText = consent?.text || 'consent';
    db.prepare(`INSERT INTO consents (contactId, consentText, consentVersion, ipAddress, userAgent) VALUES (?, ?, ?, ?, ?)`)
      .run(contactId, cText, 'v1', req.ip, req.get('User-Agent') || '');

    return res.json({ contactId, profileUrl: `/c/${slug}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Serve a simple public profile with vCard download
app.get('/c/:slug', (req, res) => {
  const slug = req.params.slug;
  const row = db.prepare(`SELECT c.*, p.id as pid FROM profiles p JOIN contacts c ON c.id = p.contactId WHERE p.slug = ? AND p.isPublic = 1`).get(slug);
  if (!row) return res.status(404).send('Not found');
  db.prepare(`UPDATE profiles SET viewCount = viewCount + 1, updatedAt = datetime('now') WHERE id = ?`).run(row.pid);

  const contact = {
    firstName: row.firstName, lastName: row.lastName, title: row.title, company: row.company,
    email: row.email, mobile: row.mobile, workPhone: row.workPhone, website: row.website,
    socials: JSON.parse(row.socials_json || '{}'), address: JSON.parse(row.address_json || '{}'),
    notes: row.notes
  };
  const vcfUrl = `/api/contacts/${row.id}.vcf`;
  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${contact.firstName} ${contact.lastName} • Card</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 2rem; color:#111827;}
    .card { max-width: 640px; border:1px solid #e5e7eb; padding: 16px; border-radius: 12px; }
    h1 { margin: 0 0 4px 0; }
    .muted { color:#6b7280; }
    a.btn { display:inline-block; padding:10px 14px; background:#0F766E; color:#fff; border-radius:8px; text-decoration:none; font-weight:600; }
  </style>
  </head><body>
  <div class="card">
    <h1>${contact.firstName} ${contact.lastName}</h1>
    <div class="muted">${contact.title || ''} ${contact.company ? ' • ' + contact.company : ''}</div>
    <p>Email: <a href="mailto:${contact.email}">${contact.email}</a><br>
    Mobile: ${contact.mobile}${contact.website ? `<br>Website: <a href="${contact.website}" target="_blank" rel="noopener">${contact.website}</a>` : ''}</p>
    <p><a class="btn" href="${vcfUrl}">Download vCard (.vcf)</a></p>
  </div>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

// Serve a .vcf for a contact ID
app.get('/api/contacts/:id.vcf', (req, res) => {
  const id = Number(req.params.id || 0);
  const row = db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(id);
  if (!row) return res.status(404).send('Not found');
  const contact = {
    firstName: row.firstName, lastName: row.lastName, title: row.title, company: row.company,
    email: row.email, mobile: row.mobile, workPhone: row.workPhone, website: row.website,
    socials: JSON.parse(row.socials_json || '{}'), address: JSON.parse(row.address_json || '{}'),
    notes: row.notes
  };
  const vcf = buildVCard(contact);
  res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="contact_${id}.vcf"`);
  return res.send(vcf);
});

// Minimal admin list (no auth in demo; add auth in production)
app.get('/api/admin/contacts', (req, res) => {
  const rows = db.prepare(`SELECT id, firstName, lastName, email, mobile, website, createdAt FROM contacts ORDER BY id DESC LIMIT 100`).all();
  return res.json({ contacts: rows });
});

app.listen(PORT, () => {
  console.log(`QR Card backend running on http://localhost:${PORT}`);
});
