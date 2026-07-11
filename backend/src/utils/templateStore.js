const fs = require('fs');
const path = require('path');

const templatesDir = path.resolve(__dirname, '../../output/template-assets');
const statePath = path.join(templatesDir, 'template-state.json');
const frontTemplatePath = path.join(templatesDir, 'active-front.png');
const backTemplatePath = path.join(templatesDir, 'active-back.png');

function ensureTemplatesDir() {
  fs.mkdirSync(templatesDir, { recursive: true });
}

function readState() {
  ensureTemplatesDir();

  if (!fs.existsSync(statePath)) {
    return {
      front: null,
      back: null,
      updatedAt: null,
    };
  }

  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (_error) {
    return {
      front: null,
      back: null,
      updatedAt: null,
    };
  }
}

function writeState(state) {
  ensureTemplatesDir();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

function sanitizeFileName(fileName) {
  return path.basename(fileName || 'template.png');
}

function saveTemplateFile(targetPath, templateFile) {
  if (!templateFile) {
    return null;
  }

  const fileName = sanitizeFileName(templateFile.fileName);
  const mimeType = templateFile.mimeType || 'image/png';
  if (mimeType !== 'image/png' || path.extname(fileName).toLowerCase() !== '.png') {
    throw new Error('Solo se permiten archivos PNG para las plantillas.');
  }

  const content = templateFile.base64 || templateFile.data || '';
  if (!content) {
    throw new Error('El archivo de plantilla está vacío.');
  }

  const buffer = Buffer.from(content, 'base64');
  if (buffer.length === 0) {
    throw new Error('No se pudo leer el archivo de plantilla.');
  }

  fs.writeFileSync(targetPath, buffer);
  return targetPath;
}

function upsertTemplates({ frontTemplate, backTemplate }) {
  ensureTemplatesDir();
  const currentState = readState();

  const nextState = {
    front: currentState.front || null,
    back: currentState.back || null,
    updatedAt: new Date().toISOString(),
  };

  if (frontTemplate) {
    saveTemplateFile(frontTemplatePath, frontTemplate);
    nextState.front = {
      fileName: sanitizeFileName(frontTemplate.fileName),
      mimeType: 'image/png',
      path: frontTemplatePath,
      updatedAt: nextState.updatedAt,
    };
  }

  if (backTemplate) {
    saveTemplateFile(backTemplatePath, backTemplate);
    nextState.back = {
      fileName: sanitizeFileName(backTemplate.fileName),
      mimeType: 'image/png',
      path: backTemplatePath,
      updatedAt: nextState.updatedAt,
    };
  }

  writeState(nextState);
  return nextState;
}

function getTemplateState() {
  return readState();
}

function getActiveTemplatePath(side) {
  const templatePath = side === 'front' ? frontTemplatePath : backTemplatePath;
  return fs.existsSync(templatePath) ? templatePath : '';
}

function getTemplateInfo() {
  const state = readState();
  return {
    front: state.front,
    back: state.back,
    activePaths: {
      front: getActiveTemplatePath('front'),
      back: getActiveTemplatePath('back'),
    },
    updatedAt: state.updatedAt,
  };
}

module.exports = {
  templatesDir,
  statePath,
  frontTemplatePath,
  backTemplatePath,
  upsertTemplates,
  getTemplateState,
  getTemplateInfo,
  getActiveTemplatePath,
};
