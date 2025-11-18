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
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(120deg, #1e3c72, #7e22ce);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
          }
          .panel {
            background: rgba(255, 255, 255, 0.96);
            padding: 40px;
            border-radius: 24px;
            width: min(620px, 100%);
            text-align: center;
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.25);
          }
          h1 { margin-bottom: 10px; font-size: 2rem; color: #1a202c; }
          p { color: #4a5568; line-height: 1.6; }
          ul { text-align: left; color: #4a5568; margin: 20px auto; padding-left: 20px; }
          .cta {
            display: inline-block;
            margin-top: 30px;
            padding: 15px 35px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-radius: 999px;
            text-decoration: none;
            font-weight: 600;
            box-shadow: 0 15px 30px rgba(102, 126, 234, 0.35);
          }
          .cta:hover { transform: translateY(-2px); }
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e22ce 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 30px;
            box-shadow: 0 30px 80px rgba(0,0,0,0.3);
            padding: 60px 50px;
            max-width: 780px;
            width: 100%;
            text-align: center;
          }
          .logo {
            width: 120px;
            height: 120px;
            margin: 0 auto 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 60px;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
          }
          h1 {
            color: #1a202c;
            font-size: 2.8em;
            font-weight: 800;
            margin-bottom: 15px;
            letter-spacing: -1px;
          }
          .subtitle {
            color: #4a5568;
            font-size: 1.15em;
            margin-bottom: 30px;
            font-weight: 500;
          }
          .status {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 15px;
            margin: 30px 0;
            font-size: 1.1em;
            font-weight: 600;
            box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
          }
          .features {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin: 40px 0;
          }
          .feature {
            background: #f7fafc;
            padding: 25px;
            border-radius: 15px;
            border: 2px solid #e2e8f0;
          }
          .feature-icon {
            font-size: 2.5em;
            margin-bottom: 10px;
          }
          .feature-title {
            color: #2d3748;
            font-weight: 700;
            font-size: 1.05em;
            margin-bottom: 8px;
          }
          .feature-desc {
            color: #718096;
            font-size: 0.9em;
          }
          .actions {
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 20px;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 18px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-size: 1.05em;
            font-weight: 700;
            transition: all 0.3s;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
          }
          .btn.secondary {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.35);
          }
          .btn:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(102, 126, 234, 0.5);
          }
          @media (max-width: 600px) {
            .features { grid-template-columns: 1fr; }
            h1 { font-size: 2em; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🔐</div>
          <h1>Face Recognition System</h1>
          <p class="subtitle">Système intelligent de reconnaissance faciale</p>
          
          <div class="status">
            ✅ Pipeline opérationnel (S3 ➜ Lambda ➜ MySQL ➜ Webapp)
          </div>
          
          <div class="features">
            <div class="feature">
              <div class="feature-icon">📸</div>
              <div class="feature-title">Détection</div>
              <div class="feature-desc">AWS Rekognition</div>
            </div>
            <div class="feature">
              <div class="feature-icon">🗄️</div>
              <div class="feature-title">Stockage</div>
              <div class="feature-desc">MySQL sécurisé</div>
            </div>
            <div class="feature">
              <div class="feature-icon">☁️</div>
              <div class="feature-title">Cloud</div>
              <div class="feature-desc">Architecture AWS</div>
            </div>
            <div class="feature">
              <div class="feature-icon">🔒</div>
              <div class="feature-title">Sécurité</div>
              <div class="feature-desc">VPC privé</div>
            </div>
          </div>
          
          <div class="actions">
            <a href="/faces" class="btn">Voir les visages enregistrés →</a>
            <a href="/upload" class="btn secondary">Ajouter un visage</a>
          </div>
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
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #7e22ce 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .card {
            width: min(720px, 100%);
            background: rgba(255, 255, 255, 0.95);
            border-radius: 30px;
            padding: 40px;
            box-shadow: 0 25px 60px rgba(0,0,0,0.25);
          }
          h1 { margin-bottom: 10px; font-size: 2.3rem; color: #1a202c; }
          p { color: #4a5568; margin-bottom: 30px; }
          form { display: grid; gap: 20px; }
          label { font-weight: 600; color: #2d3748; }
          input[type="text"],
          input[type="file"] {
            width: 100%;
            padding: 16px;
            border-radius: 16px;
            border: 2px solid #e2e8f0;
            font-size: 1rem;
          }
          .hint {
            font-size: 0.85rem;
            color: #718096;
            margin-top: 8px;
          }
          button {
            border: none;
            border-radius: 40px;
            padding: 18px;
            font-size: 1.1rem;
            font-weight: 700;
            color: white;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            cursor: pointer;
            box-shadow: 0 20px 35px rgba(102, 126, 234, 0.35);
            transition: transform 0.3s;
          }
          button:hover { transform: translateY(-3px); }
          .back {
            display: inline-block;
            margin-top: 25px;
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
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
          <a href="/" class="back">← Retour à l’accueil</a>
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
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e22ce 100%);
              min-height: 100vh;
              padding: 40px 20px;
            }
            .container {
              max-width: 1400px;
              margin: 0 auto;
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(10px);
              border-radius: 30px;
              padding: 50px;
              box-shadow: 0 30px 80px rgba(0,0,0,0.3);
            }
            .header {
              text-align: center;
              margin-bottom: 50px;
            }
            h1 {
              color: #1a202c;
              font-size: 3em;
              font-weight: 800;
              margin-bottom: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 20px;
            }
            .stats {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px 40px;
              border-radius: 15px;
              display: inline-block;
              font-size: 1.3em;
              font-weight: 700;
              box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
              gap: 30px;
              margin-top: 40px;
            }
            .card {
              background: white;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 8px 30px rgba(0,0,0,0.1);
              transition: all 0.3s;
              border: 3px solid transparent;
            }
            .card:hover {
              transform: translateY(-10px);
              box-shadow: 0 15px 50px rgba(0,0,0,0.2);
              border-color: #667eea;
            }
            .card-image {
              width: 100%;
              height: 280px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 100px;
              color: white;
              position: relative;
              overflow: hidden;
            }
            .card-image img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .card-image::before {
              content: '';
              position: absolute;
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
              animation: pulse 3s ease-in-out infinite;
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }
            .card-content {
              padding: 25px;
            }
            .card-id {
              background: #f7fafc;
              color: #667eea;
              padding: 8px 15px;
              border-radius: 8px;
              font-size: 0.85em;
              font-weight: 700;
              display: inline-block;
              margin-bottom: 15px;
            }
            .card-name {
              font-size: 1.8em;
              font-weight: 800;
              color: #1a202c;
              margin-bottom: 15px;
              text-transform: capitalize;
            }
            .card-faceid {
              background: #f7fafc;
              padding: 15px;
              border-radius: 10px;
              border-left: 4px solid #667eea;
              margin-top: 15px;
            }
            .card-faceid-label {
              font-size: 0.75em;
              color: #718096;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 8px;
            }
            .card-faceid-value {
              font-family: 'Courier New', monospace;
              font-size: 0.85em;
              color: #4a5568;
              word-break: break-all;
              line-height: 1.6;
            }
            .meta {
              margin-top: 15px;
              font-size: 0.85em;
              color: #718096;
              word-break: break-all;
            }
            .empty-state {
              text-align: center;
              padding: 80px 20px;
              color: #718096;
            }
            .empty-state-icon {
              font-size: 100px;
              margin-bottom: 20px;
              opacity: 0.3;
            }
            .empty-state-text {
              font-size: 1.3em;
              margin-bottom: 30px;
            }
            .back-btn {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 18px 45px;
              text-decoration: none;
              border-radius: 50px;
              font-weight: 700;
              font-size: 1.1em;
              transition: all 0.3s;
              margin-top: 30px;
              box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
            }
            .back-btn:hover {
              transform: translateY(-3px);
              box-shadow: 0 12px 35px rgba(102, 126, 234, 0.5);
            }
            @media (max-width: 768px) {
              .container { padding: 30px 20px; }
              h1 { font-size: 2em; }
              .grid { grid-template-columns: 1fr; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>
                <span>📸</span>
                <span>Visages Enregistrés</span>
              </h1>
              <div class="stats">
                Total : ${rows.length} personne${rows.length > 1 ? 's' : ''}
              </div>
            </div>
    `;
    
    if (rows.length === 0) {
      html += `
        <div class="empty-state">
          <div class="empty-state-icon">🤷</div>
          <div class="empty-state-text">
            Aucun visage enregistré pour le moment
          </div>
          <p style="color: #a0aec0;">
            Uploadez une image sur S3 avec le format : <code>nom_prenom.jpg</code>
          </p>
        </div>
      `;
    } else {
      html += '<div class="grid">';
      
      rows.forEach(row => {
        const avatars = ['👨', '👩', '🧑', '👴', '👵', '🧔', '👨‍💼', '👩‍💼', '👨‍🎓', '👩‍🎓'];
        const avatarIndex = row.firstname ? row.firstname.charCodeAt(0) % avatars.length : 0;
        const avatar = avatars[avatarIndex];
        const firstname = beautifyName(row.firstname || '');
        const lastname = beautifyName(row.lastname || '');
        const photoUrl = ENABLE_PUBLIC_PHOTO_PREVIEW && row.object_key
          ? `${PUBLIC_MEDIA_BASE_URL}/${row.object_key}`
          : null;
        
        html += `
          <div class="card">
            <div class="card-image">
              ${photoUrl ? `<img src="${photoUrl}" alt="Photo de ${escapeHtml(firstname)} ${escapeHtml(lastname)}" />` : avatar}
            </div>
            <div class="card-content">
              <div class="card-id">ID: ${escapeHtml(row.id)}</div>
              <div class="card-name">
                ${escapeHtml(firstname)} ${escapeHtml(lastname)}
              </div>
              <div class="card-faceid">
                <div class="card-faceid-label">Face ID Rekognition</div>
                <div class="card-faceid-value">${row.identity ? escapeHtml(row.identity) : '⏳ En attente du traitement Lambda'}</div>
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
              <a href="/" class="back-btn">← Retour à l'accueil</a>
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Bucket cible: ${BUCKET_NAME} (${AWS_REGION})`);
  console.log(`✅ Base de données: ${dbConfig.database} @ ${dbConfig.host}:${dbConfig.port}`);
});
