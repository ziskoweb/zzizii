const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const moment = require('moment');
const app = express();
const PORT = 3324;
const LICENSES_FILE = 'licenses.json';
let validLicenses = [];
app.use(express.json());
function loadLicenses() {
  if (fs.existsSync(LICENSES_FILE)) {
    try {
      const data = fs.readFileSync(LICENSES_FILE);
      const parsedData = JSON.parse(data);
      if (Array.isArray(parsedData)) {
        validLicenses = parsedData;
      } else {
        console.error('Invalid data format in LICENSES_FILE. Expected an array.');
      }
    } catch (error) {
      console.error('Error reading or parsing LICENSES_FILE:', error);
    }
  } else {
    console.log('LICENSES_FILE not found, starting with an empty license list.');
  }
}

function saveLicenses() {
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(validLicenses, null, 2));
}

loadLicenses();

// Helper pour calculer la date d'expiration
function calculateExpiry(duration) {
  if (duration === 'lifetime') {
    return new Date('9999-12-31'); // Date très éloignée dans le futur
  }

  const now = moment();
  const durationRegex = /(\d+)\s*(hour|day|month|year)s?/g; // Regex pour capturer la durée et l'unité

  let match;
  while ((match = durationRegex.exec(duration)) !== null) {
    const amount = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'hour':
        now.add(amount, 'hours');
        break;
      case 'day':
        now.add(amount, 'days');
        break;
      case 'month':
        now.add(amount, 'months');
        break;
      case 'year':
        now.add(amount, 'years');
        break;
    }
  }

  return now.toDate();
}

// Fonction pour nettoyer les licences expirées
function cleanExpiredLicenses() {
  const now = new Date();
  const initialLicenseCount = validLicenses.length;
  validLicenses = validLicenses.filter(license => new Date(license.expiryDate) > now);

  if (initialLicenseCount !== validLicenses.length) {
    console.log(`Removed ${initialLicenseCount - validLicenses.length} expired licenses.`);
    saveLicenses(); // Sauvegarder après nettoyage si des licences ont été supprimées
  }
}

// Route pour vérifier une licence
app.get('/GetMainInfo', (req, res) => {
  cleanExpiredLicenses(); // Nettoyer les licences expirées avant de vérifier

  const licenseKey = req.query.keyused;

  if (!licenseKey) {
    return res.status(400).send('License key is required');
  }

  const license = validLicenses.find(lic => lic.key === licenseKey);

  if (license) {
    const now = new Date();
    if (now <= new Date(license.expiryDate)) {
      return res.status(200).send('License is valid');
    } else {
      return res.status(403).send('License has expired');
    }
  } else {
    return res.status(404).send('License is not valid');
  }
});

// Route pour générer une nouvelle licence
app.post('/GenerateLicense', (req, res) => {
  cleanExpiredLicenses(); // Nettoyer les licences expirées avant de générer une nouvelle licence

  const duration = req.body.duration; // Expects duration to be passed in the body

  if (!duration) {
    return res.status(400).send('Duration is required');
  }

  const expiryDate = calculateExpiry(duration);

  if (!expiryDate) {
    return res.status(400).send('Invalid duration');
  }

  const newLicense = {
    key: `EyesShield-${uuidv4()}`,
    expiryDate: expiryDate
  };

  validLicenses.push(newLicense);
  saveLicenses(); // Sauvegarder après ajout

  // Formater la date d'expiration pour un affichage lisible
  const formattedExpiryDate = moment(expiryDate).format('YYYY-MM-DD HH:mm:ss');

  return res.status(201).json({ license: newLicense.key, expiryDate: formattedExpiryDate });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
