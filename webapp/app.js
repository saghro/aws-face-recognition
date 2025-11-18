const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3000;

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.BUCKET_NAME || 'myfaces-uploads-ayoub2025';
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp';
const ENABLE_PUBLIC_PHOTO_PREVIEW = process.env.ENABLE_PUBLIC_PHOTO_PREVIEW === 'true';
const PUBLIC_MEDIA_BASE_URL = (process.env.PUBLIC_MEDIA_BASE_URL || `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`).replace(/\/$/, '');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'mydbuser',
  password: process.env.DB_PASSWORD || 'MySecurePassword123!',
  database: process.env.DB_NAME || 'faces_db',
  port: Number(process.env.DB_PORT || 3306)
};

const s3Client = new S3Client({ region: AWS_REGION });

const sanitizeKeyPart = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'unknown';

const beautifyName = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    || 'Inconnu';

const normalizeExtension = (filename = '') => {
  const ext = path.extname(filename).toLowerCase();
  return ext || '.jpg';
};

const escapeHtml = (value = '') =>
  value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildObjectKey = (lastname, firstname, originalname) => {
  const ext = normalizeExtension(originalname);
  return `${lastname}_${firstname}${ext}`;
};

const renderStatusPage = (title, message, options = {}) => {
  const list = (options.list || [])
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const link = options.link
    ? `<a href="${escapeHtml(options.link.href)}" class="cta">${escapeHtml(options.link.label)}</a>`
    : '<a href="/" class="cta">← Retour à l’accueil</a>';

  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #fafafa;
            color: #1a1a1a;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            line-height: 1.6;
          }
          .panel {
            background: #ffffff;
            padding: 60px 50px;
            border-radius: 12px;
            width: min(600px, 100%);
            text-align: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          h1 { 
            margin-bottom: 20px; 
            font-size: 2rem; 
            font-weight: 600;
            color: #1a1a1a; 
            letter-spacing: -0.5px;
          }
          p { 
            color: #666666; 
            line-height: 1.7;
            margin-bottom: 20px;
            font-size: 1rem;
          }
          ul { 
            text-align: left; 
            color: #666666; 
            margin: 30px auto; 
            padding-left: 25px;
            max-width: 400px;
          }
          li {
            margin-bottom: 8px;
          }
          .cta {
            display: inline-block;
            margin-top: 30px;
            padding: 14px 32px;
            background: #1a1a1a;
            color: #ffffff;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            font-size: 0.95rem;
            transition: background 0.2s ease;
          }
          .cta:hover { 
            background: #333333;
          }
        </style>
      </head>
      <body>
        <div class="panel">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(message)}</p>
          ${list ? `<ul>${list}</ul>` : ''}
          ${link}
        </div>
      </body>
    </html>
  `;
};

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    try {
      const lastnameKey = sanitizeKeyPart(req.body.lastname);
      const firstnameKey = sanitizeKeyPart(req.body.firstname);
      cb(null, buildObjectKey(lastnameKey, firstnameKey, file.originalname));
    } catch (error) {
      cb(error);
    }
  }
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Seuls les fichiers image sont autorisés.'));
    }
    cb(null, true);
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const fetchFaces = async () => {
  const connection = await mysql.createConnection(dbConfig);
  const [rows] = await connection.execute('SELECT * FROM person ORDER BY id DESC');
  await connection.end();
  return rows;
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Face Recognition System</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #fafafa;
            color: #1a1a1a;
            min-height: 100vh;
            padding: 60px 20px;
          }
          .header {
            max-width: 1200px;
            margin: 0 auto 80px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
          }
          .header-info {
            display: flex;
            gap: 12px;
            align-items: center;
          }
          .email-link {
            color: #1a1a1a;
            text-decoration: none;
            font-size: 0.95rem;
          }
          .btn-link {
            padding: 8px 16px;
            background: #f5f5f5;
            border-radius: 8px;
            text-decoration: none;
            color: #1a1a1a;
            font-size: 0.9rem;
            font-weight: 500;
            transition: background 0.2s;
          }
          .btn-link:hover {
            background: #e8e8e8;
          }
          .social-links {
            color: #666666;
            font-size: 0.95rem;
          }
          .hero {
            max-width: 900px;
            margin: 0 auto 100px;
            text-align: center;
          }
          .hero-profile {
            display: inline-block;
            margin-bottom: 40px;
          }
          .profile-img {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: #e8e8e8;
            margin: 0 auto 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: #999999;
          }
          .profile-tag {
            font-size: 0.9rem;
            color: #666666;
            font-weight: 500;
          }
          h1 {
            font-size: 3.5rem;
            font-weight: 600;
            margin-bottom: 20px;
            letter-spacing: -1.5px;
            line-height: 1.1;
            color: #1a1a1a;
          }
          .btn-primary {
            display: inline-block;
            margin-top: 40px;
            padding: 14px 32px;
            background: #1a1a1a;
            color: #ffffff;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            font-size: 0.95rem;
            transition: background 0.2s ease;
          }
          .btn-primary:hover {
            background: #333333;
          }
          .features-section {
            max-width: 1200px;
            margin: 0 auto 100px;
          }
          .section-header {
            text-align: center;
            margin-bottom: 60px;
          }
          .section-tag {
            font-size: 0.85rem;
            color: #999999;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
          }
          .section-title {
            font-size: 2rem;
            font-weight: 600;
            color: #1a1a1a;
            letter-spacing: -0.5px;
          }
          .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 30px;
            margin-top: 50px;
          }
          .feature-card {
            background: #ffffff;
            padding: 40px 30px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          .feature-icon {
            width: 48px;
            height: 48px;
            margin-bottom: 24px;
            background: #f5f5f5;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: #666666;
          }
          .feature-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 12px;
            color: #1a1a1a;
          }
          .feature-desc {
            color: #666666;
            line-height: 1.6;
            font-size: 0.95rem;
          }
          .actions-section {
            max-width: 600px;
            margin: 0 auto;
            text-align: center;
          }
          .actions-title {
            font-size: 2rem;
            font-weight: 600;
            margin-bottom: 40px;
            letter-spacing: -0.5px;
            color: #1a1a1a;
          }
          .actions-buttons {
            display: flex;
            gap: 16px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .btn {
            padding: 14px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            font-size: 0.95rem;
            transition: all 0.2s ease;
          }
          .btn-black {
            background: #1a1a1a;
            color: #ffffff;
          }
          .btn-black:hover {
            background: #333333;
          }
          .btn-outline {
            background: #ffffff;
            color: #1a1a1a;
            border: 1.5px solid #1a1a1a;
          }
          .btn-outline:hover {
            background: #fafafa;
          }
          .footer {
            max-width: 1200px;
            margin: 100px auto 0;
            padding-top: 60px;
            border-top: 1px solid #e8e8e8;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
            color: #999999;
            font-size: 0.9rem;
          }
          @media (max-width: 768px) {
            h1 { font-size: 2.5rem; }
            .hero { margin-bottom: 60px; }
            .features-grid { grid-template-columns: 1fr; }
            .header { flex-direction: column; align-items: flex-start; }
          }
        </style>
      </head>
      <body>
        <div class="hero">
          <div class="hero-profile">
            <div class="profile-img">FR</div>
            <div class="profile-tag">Face Recognition System</div>
          </div>
          <h1>Building digital products, brands, and experience.</h1>
          <a href="/faces" class="btn-primary">Latest Shots ↗</a>
        </div>

        <div class="features-section">
          <div class="section-header">
            <div class="section-tag">Services</div>
            <h2 class="section-title">Collaborate with brands and agencies to create impactful results.</h2>
          </div>
          <div class="features-grid">
            <div class="feature-card">
              <div class="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 9h6v6H9z"/>
                </svg>
              </div>
              <div class="feature-title">Face Detection</div>
              <div class="feature-desc">Advanced facial recognition using AWS Rekognition for accurate identification and indexing.</div>
            </div>
            <div class="feature-card">
              <div class="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
              </div>
              <div class="feature-title">Cloud Storage</div>
              <div class="feature-desc">Secure and scalable storage with Amazon S3 for reliable image management.</div>
            </div>
            <div class="feature-card">
              <div class="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div class="feature-title">Database</div>
              <div class="feature-desc">MySQL database for secure and efficient data management with optimized queries.</div>
            </div>
            <div class="feature-card">
              <div class="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div class="feature-title">Security</div>
              <div class="feature-desc">Enterprise-grade security with VPC isolation and encrypted data transmission.</div>
            </div>
          </div>
        </div>

        <div class="actions-section">
          <h2 class="actions-title">Tell me about your next project</h2>
          <div class="actions-buttons">
            <a href="/upload" class="btn btn-black">Email Me</a>
            <a href="/faces" class="btn btn-outline">View Faces</a>
          </div>
        </div>

        <div class="footer">
          <div>© 2024 All rights reserved.</div>
        </div>
      </body>
    </html>
  `);
});

app.get('/upload', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ajouter un visage</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #fafafa;
            color: #1a1a1a;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 40px 20px;
          }
          .container {
            max-width: 1200px;
            width: 100%;
            margin: 0 auto;
          }
          .header {
            margin-bottom: 60px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
          }
          .back-link {
            color: #1a1a1a;
            text-decoration: none;
            font-size: 0.95rem;
            font-weight: 500;
            transition: color 0.2s;
          }
          .back-link:hover {
            color: #666666;
          }
          .card {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            padding: 60px 50px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          h1 { 
            margin-bottom: 16px; 
            font-size: 2rem; 
            font-weight: 600;
            color: #1a1a1a; 
            letter-spacing: -0.5px;
          }
          p { 
            color: #666666; 
            margin-bottom: 40px; 
            line-height: 1.7;
            font-size: 1rem;
          }
          form { 
            display: grid; 
            gap: 24px; 
          }
          label { 
            font-weight: 500; 
            color: #1a1a1a; 
            font-size: 0.95rem;
            display: block;
            margin-bottom: 8px;
          }
          input[type="text"],
          input[type="file"] {
            width: 100%;
            padding: 14px 16px;
            border-radius: 8px;
            border: 1.5px solid #e8e8e8;
            font-size: 0.95rem;
            font-family: inherit;
            background: #ffffff;
            color: #1a1a1a;
            transition: border-color 0.2s;
          }
          input[type="text"]:focus,
          input[type="file"]:focus {
            outline: none;
            border-color: #1a1a1a;
          }
          .hint {
            font-size: 0.85rem;
            color: #999999;
            margin-top: 8px;
          }
          button {
            border: none;
            border-radius: 8px;
            padding: 14px 32px;
            font-size: 0.95rem;
            font-weight: 500;
            color: #ffffff;
            background: #1a1a1a;
            cursor: pointer;
            transition: background 0.2s ease;
            font-family: inherit;
          }
          button:hover { 
            background: #333333;
          }
          .back {
            display: inline-block;
            margin-top: 32px;
            color: #666666;
            text-decoration: none;
            font-weight: 500;
            font-size: 0.95rem;
            transition: color 0.2s;
          }
          .back:hover {
            color: #1a1a1a;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Ajouter un visage</h1>
          <p>Saisissez un nom/prénom puis chargez une photo (.jpg/.png). La convention <strong>nom_prenom.ext</strong> est appliquée automatiquement pour déclencher Lambda.</p>
          <form action="/upload" method="POST" enctype="multipart/form-data">
            <div>
              <label for="lastname">Nom</label>
              <input type="text" id="lastname" name="lastname" required placeholder="Ex. Dupont" />
            </div>
            <div>
              <label for="firstname">Prénom</label>
              <input type="text" id="firstname" name="firstname" required placeholder="Ex. Clara" />
            </div>
            <div>
              <label for="photo">Photo</label>
              <input type="file" id="photo" name="photo" accept="image/*" required />
              <p class="hint">Taille max : ${(process.env.MAX_FILE_SIZE_MB || 5)} Mo</p>
            </div>
            <button type="submit">Envoyer vers S3</button>
          </form>
          <a href="/" class="back">Retour à l'accueil</a>
        </div>
      </body>
    </html>
  `);
});

app.get('/faces', async (req, res) => {
  try {
    const rows = await fetchFaces();
    
    let html = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Visages Enregistrés</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background: #fafafa;
              color: #1a1a1a;
              min-height: 100vh;
              padding: 60px 20px;
            }
            .container {
              max-width: 1400px;
              margin: 0 auto;
            }
            .header-section {
              margin-bottom: 60px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              gap: 20px;
            }
            .back-link {
              color: #1a1a1a;
              text-decoration: none;
              font-size: 0.95rem;
              font-weight: 500;
              transition: color 0.2s;
            }
            .back-link:hover {
              color: #666666;
            }
            .page-header {
              text-align: center;
              margin-bottom: 60px;
            }
            h1 {
              font-size: 3rem;
              font-weight: 600;
              margin-bottom: 16px;
              letter-spacing: -1px;
              color: #1a1a1a;
            }
            .stats {
              display: inline-block;
              padding: 12px 24px;
              background: #f5f5f5;
              border-radius: 8px;
              font-size: 1rem;
              font-weight: 500;
              color: #666666;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
              gap: 30px;
              margin-bottom: 60px;
            }
            .card {
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
              transition: all 0.2s ease;
            }
            .card:hover {
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
              transform: translateY(-2px);
            }
            .card-image {
              width: 100%;
              height: 280px;
              background: #e8e8e8;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              overflow: hidden;
            }
            .card-image img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .card-placeholder {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: #f5f5f5;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
              color: #999999;
              font-weight: 500;
            }
            .card-content {
              padding: 30px;
            }
            .card-id {
              background: #f5f5f5;
              color: #666666;
              padding: 6px 12px;
              border-radius: 6px;
              font-size: 0.8rem;
              font-weight: 500;
              display: inline-block;
              margin-bottom: 16px;
            }
            .card-name {
              font-size: 1.5rem;
              font-weight: 600;
              margin-bottom: 20px;
              text-transform: capitalize;
              color: #1a1a1a;
              letter-spacing: -0.3px;
            }
            .card-faceid {
              background: #fafafa;
              padding: 16px;
              border-radius: 8px;
              border-left: 2px solid #1a1a1a;
              margin-top: 16px;
            }
            .card-faceid-label {
              font-size: 0.75rem;
              color: #999999;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 8px;
            }
            .card-faceid-value {
              font-family: 'Courier New', monospace;
              font-size: 0.85rem;
              color: #1a1a1a;
              word-break: break-all;
              line-height: 1.5;
            }
            .meta {
              margin-top: 16px;
              font-size: 0.85rem;
              color: #999999;
              word-break: break-all;
            }
            .empty-state {
              text-align: center;
              padding: 100px 20px;
            }
            .empty-state-text {
              font-size: 1.25rem;
              margin-bottom: 16px;
              color: #666666;
              font-weight: 500;
            }
            .empty-state-desc {
              color: #999999;
              font-size: 0.95rem;
            }
            .back-btn {
              display: inline-block;
              background: #1a1a1a;
              color: #ffffff;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 500;
              font-size: 0.95rem;
              transition: background 0.2s ease;
              margin-top: 40px;
            }
            .back-btn:hover {
              background: #333333;
            }
            @media (max-width: 768px) {
              h1 { font-size: 2rem; }
              .grid { grid-template-columns: 1fr; }
              .container { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header-section">
              <a href="/" class="back-link">← Retour</a>
            </div>
            <div class="page-header">
              <h1>Visages Enregistrés</h1>
              <div class="stats">
                Total : ${rows.length} personne${rows.length > 1 ? 's' : ''}
              </div>
            </div>
    `;
    
    if (rows.length === 0) {
      html += `
        <div class="empty-state">
          <div class="empty-state-text">
            Aucun visage enregistré pour le moment
          </div>
          <div class="empty-state-desc">
            Uploadez une image sur S3 avec le format : <code>nom_prenom.jpg</code>
          </div>
        </div>
      `;
    } else {
      html += '<div class="grid">';
      
      rows.forEach(row => {
        const firstname = beautifyName(row.firstname || '');
        const lastname = beautifyName(row.lastname || '');
        const initials = (firstname.charAt(0) || '') + (lastname.charAt(0) || '') || '?';
        const photoUrl = ENABLE_PUBLIC_PHOTO_PREVIEW && row.object_key
          ? `${PUBLIC_MEDIA_BASE_URL}/${row.object_key}`
          : null;
        
        html += `
          <div class="card">
            <div class="card-image">
              ${photoUrl ? `<img src="${photoUrl}" alt="Photo de ${escapeHtml(firstname)} ${escapeHtml(lastname)}" />` : `<div class="card-placeholder">${initials}</div>`}
            </div>
            <div class="card-content">
              <div class="card-id">ID: ${escapeHtml(row.id)}</div>
              <div class="card-name">
                ${escapeHtml(firstname)} ${escapeHtml(lastname)}
              </div>
              <div class="card-faceid">
                <div class="card-faceid-label">Face ID Rekognition</div>
                <div class="card-faceid-value">${row.identity ? escapeHtml(row.identity) : 'En attente du traitement Lambda'}</div>
              </div>
              <div class="meta">
                <strong>Objet S3 :</strong> ${row.object_key ? escapeHtml(row.object_key) : '—'}
              </div>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    }
    
    html += `
            <div style="text-align: center;">
              <a href="/" class="back-btn">Retour à l'accueil</a>
            </div>
          </div>
        </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send(renderStatusPage('Erreur de connexion', 'Impossible de récupérer les visages.', {
      list: [error.message],
      link: { href: '/', label: 'Retour à l’accueil' }
    }));
  }
});

app.get('/api/faces', async (req, res) => {
  try {
    const rows = await fetchFaces();
    res.json({ 
      success: true, 
      count: rows.length, 
      data: rows 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/upload', upload.single('photo'), async (req, res) => {
  const firstnameRaw = req.body.firstname || '';
  const lastnameRaw = req.body.lastname || '';

  if (!firstnameRaw.trim() || !lastnameRaw.trim()) {
    return res
      .status(400)
      .send(renderStatusPage('Champs obligatoires', 'Nom et prénom sont requis.', { link: { href: '/upload', label: 'Réessayer' } }));
  }

  if (!req.file) {
    return res
      .status(400)
      .send(renderStatusPage('Fichier manquant', 'Ajoutez une photo avant de soumettre.', { link: { href: '/upload', label: 'Réessayer' } }));
  }

  const firstname = beautifyName(firstnameRaw);
  const lastname = beautifyName(lastnameRaw);
  const firstnameKey = sanitizeKeyPart(firstnameRaw);
  const lastnameKey = sanitizeKeyPart(lastnameRaw);
  const objectKey = buildObjectKey(lastnameKey, firstnameKey, req.file.originalname);
  const tmpPath = req.file.path;

  try {
    const buffer = await fs.readFile(tmpPath);
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Body: buffer,
      ContentType: req.file.mimetype,
      Metadata: {
        firstname,
        lastname
      }
    }));

    await fs.unlink(tmpPath).catch(() => {});

    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(`
      INSERT INTO person (lastname, firstname, identity, object_key)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE object_key = VALUES(object_key), updated_at = CURRENT_TIMESTAMP
    `, [lastname, firstname, null, objectKey]);
    await connection.end();

    res.send(
      renderStatusPage(
        'Upload réussi',
        `L’image de ${firstname} ${lastname} a bien été envoyée sur S3.`,
        {
          list: [
            `Bucket : ${BUCKET_NAME}`,
            `Objet : ${objectKey}`,
            'Le traitement Rekognition se lance automatiquement via Lambda.'
          ],
          link: { href: '/faces', label: 'Voir les visages' }
        }
      )
    );
  } catch (error) {
    console.error(error);
    await fs.unlink(tmpPath).catch(() => {});
    res
      .status(500)
      .send(renderStatusPage('Échec de l’upload', error.message, { link: { href: '/upload', label: 'Réessayer' } }));
  }
});

app.get('/healthz', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('SELECT 1');
    await connection.end();
    res.json({
      status: 'ok',
      db: 'reachable',
      bucket: BUCKET_NAME,
      region: AWS_REGION
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.use((err, req, res, next) => {
  if (!err) return next();
  console.error(err);
  const status = err.status || 500;
  res
    .status(status)
    .send(renderStatusPage('Erreur', err.message || 'Erreur interne', { link: { href: '/', label: 'Retour à l’accueil' } }));
});

// Ne pas démarrer le serveur en mode test
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
    console.log(`✅ Bucket cible: ${BUCKET_NAME} (${AWS_REGION})`);
    console.log(`✅ Base de données: ${dbConfig.database} @ ${dbConfig.host}:${dbConfig.port}`);
  });
}

module.exports = app;
