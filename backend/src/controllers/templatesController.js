const templatesService = require('../services/templatesService');

class TemplatesController {
  getTemplateInfo(_req, res, next) {
    try {
      const info = templatesService.getTemplateInfo();
      res.json(info);
    } catch (error) {
      next(error);
    }
  }

  getActiveFrontTemplate(_req, res, next) {
    try {
      const templatePath = templatesService.getActiveFrontTemplatePath();
      res.setHeader('Cache-Control', 'no-store');
      res.type('image/png');
      res.sendFile(templatePath);
    } catch (error) {
      if (error.message === 'No hay plantilla frontal activa.') {
        res.status(404).json({ message: error.message });
        return;
      }
      next(error);
    }
  }

  updateTemplates(req, res, next) {
    try {
      const result = templatesService.updateTemplates(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TemplatesController();
