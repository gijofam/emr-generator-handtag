const templateStore = require('../utils/templateStore');

class TemplatesService {
  getTemplateInfo() {
    return templateStore.getTemplateInfo();
  }

  getActiveFrontTemplatePath() {
    const templatePath = templateStore.getActiveTemplatePath('front');
    if (!templatePath) {
      throw new Error('No hay plantilla frontal activa.');
    }

    return templatePath;
  }

  updateTemplates(payload) {
    const { frontTemplate, backTemplate } = payload || {};
    if (!frontTemplate && !backTemplate) {
      throw new Error('Debes seleccionar al menos una plantilla PNG.');
    }

    return templateStore.upsertTemplates({ frontTemplate, backTemplate });
  }
}

module.exports = new TemplatesService();
