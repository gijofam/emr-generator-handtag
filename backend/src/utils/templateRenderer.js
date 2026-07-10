const fs = require('fs');
const path = require('path');
const qrService = require('../services/qrService');
const { resolveTemplatePath, getDefaultQrPlacement } = require('./printConfig');

async function createHandtagImage({ code, qrUrl, templateFrontPath, templateBackPath, qrPlacement = getDefaultQrPlacement(), outputDir }) {
  const frontPath = resolveTemplatePath(templateFrontPath);
  const backPath = resolveTemplatePath(templateBackPath);

  if (!frontPath || !backPath) {
    throw new Error('Se requieren plantillas frontal y reversa para generar el handtag.');
  }

  const qrBuffer = await qrService.generateQrBuffer(qrUrl);
  const frontBuffer = fs.existsSync(frontPath) ? fs.readFileSync(frontPath) : null;
  const backBuffer = fs.existsSync(backPath) ? fs.readFileSync(backPath) : null;

  if (!frontBuffer || !backBuffer) {
    throw new Error('No se encontraron las plantillas PNG especificadas.');
  }

  const output = {
    frontTemplatePath: frontPath,
    backTemplatePath: backPath,
    qrBuffer,
    qrPlacement,
    outputDir,
    code,
  };

  return output;
}

module.exports = {
  createHandtagImage,
};
