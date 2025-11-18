/**
 * Tests unitaires pour les fonctions utilitaires
 */

// Fonctions extraites de app.js pour faciliter les tests
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

const escapeHtml = (value = '') =>
  value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const path = require('path');
const normalizeExtension = (filename = '') => {
  const ext = path.extname(filename).toLowerCase();
  return ext || '.jpg';
};

const buildObjectKey = (lastname, firstname, originalname) => {
  const ext = normalizeExtension(originalname);
  return `${lastname}_${firstname}${ext}`;
};

describe('Fonctions utilitaires', () => {
  describe('sanitizeKeyPart', () => {
    test('normalise un nom simple', () => {
      expect(sanitizeKeyPart('Dupont')).toBe('dupont');
    });

    test('normalise un nom avec espaces', () => {
      expect(sanitizeKeyPart('Jean Pierre')).toBe('jean_pierre');
    });

    test('normalise un nom avec accents', () => {
      expect(sanitizeKeyPart('Élise')).toBe('elise');
      expect(sanitizeKeyPart('François')).toBe('francois');
    });

    test('normalise un nom avec caractères spéciaux', () => {
      expect(sanitizeKeyPart('O\'Connor')).toBe('o_connor');
      expect(sanitizeKeyPart('Van-Der-Berg')).toBe('van_der_berg');
    });

    test('gère les underscores multiples', () => {
      expect(sanitizeKeyPart('Jean___Pierre')).toBe('jean_pierre');
    });

    test('supprime les underscores en début et fin', () => {
      expect(sanitizeKeyPart('_Dupont_')).toBe('dupont');
    });

    test('retourne "unknown" pour une chaîne vide', () => {
      expect(sanitizeKeyPart('')).toBe('unknown');
      expect(sanitizeKeyPart('   ')).toBe('unknown');
    });

    test('gère les nombres', () => {
      expect(sanitizeKeyPart('Test123')).toBe('test123');
    });
  });

  describe('beautifyName', () => {
    test('formate correctement un prénom simple', () => {
      expect(beautifyName('clara')).toBe('Clara');
      expect(beautifyName('JEAN')).toBe('Jean');
    });

    test('formate un nom composé', () => {
      expect(beautifyName('jean pierre')).toBe('Jean Pierre');
      expect(beautifyName('marie-claire')).toBe('Marie Claire');
    });

    test('gère les underscores', () => {
      expect(beautifyName('jean_pierre')).toBe('Jean Pierre');
    });

    test('supprime les espaces multiples', () => {
      expect(beautifyName('jean    pierre')).toBe('Jean Pierre');
    });

    test('retourne "Inconnu" pour une chaîne vide', () => {
      expect(beautifyName('')).toBe('Inconnu');
      expect(beautifyName('   ')).toBe('Inconnu');
    });

    test('gère les valeurs non-string', () => {
      expect(beautifyName()).toBe('Inconnu');
      expect(beautifyName(undefined)).toBe('Inconnu');
    });

    test('formate correctement des noms avec accents', () => {
      expect(beautifyName('élise')).toBe('Élise');
      expect(beautifyName('FRANÇOIS')).toBe('François');
    });
  });

  describe('escapeHtml', () => {
    test('échappe les caractères HTML dangereux', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('échappe les caractères individuels', () => {
      expect(escapeHtml('&')).toBe('&amp;');
      expect(escapeHtml('<')).toBe('&lt;');
      expect(escapeHtml('>')).toBe('&gt;');
      expect(escapeHtml('"')).toBe('&quot;');
      expect(escapeHtml("'")).toBe('&#39;');
    });

    test('laisse les caractères sûrs inchangés', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
      expect(escapeHtml('123')).toBe('123');
    });

    test('gère les valeurs non-string', () => {
      expect(escapeHtml()).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });

  describe('normalizeExtension', () => {
    test('extrait l\'extension correctement', () => {
      expect(normalizeExtension('photo.jpg')).toBe('.jpg');
      expect(normalizeExtension('photo.PNG')).toBe('.png');
    });

    test('retourne .jpg par défaut si pas d\'extension', () => {
      expect(normalizeExtension('photo')).toBe('.jpg');
      expect(normalizeExtension('')).toBe('.jpg');
    });

    test('gère les extensions multiples', () => {
      expect(normalizeExtension('photo.tar.gz')).toBe('.gz');
    });
  });

  describe('buildObjectKey', () => {
    test('construit une clé correcte', () => {
      expect(buildObjectKey('dupont', 'jean', 'photo.jpg')).toBe('dupont_jean.jpg');
      expect(buildObjectKey('martin', 'marie', 'image.png')).toBe('martin_marie.png');
    });

    test('utilise .jpg par défaut si pas d\'extension', () => {
      expect(buildObjectKey('dupont', 'jean', 'photo')).toBe('dupont_jean.jpg');
    });

    test('normalise l\'extension en minuscules', () => {
      expect(buildObjectKey('dupont', 'jean', 'photo.JPG')).toBe('dupont_jean.jpg');
      expect(buildObjectKey('dupont', 'jean', 'photo.PNG')).toBe('dupont_jean.png');
    });
  });
});

