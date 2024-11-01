import { Router, Request, Response } from 'express';
import { Module } from '../handlers/moduleInit';

const coreModule: Module = {
  info: {
    name: 'Core Module',
    description: 'This file is for all core functionality.',
    version: '1.0.0',
    moduleVersion: '1.0.0',
    author: 'AirLinkLab',
    license: 'MIT',
  },

  router: () => {
    const router = Router();

    router.get('/', (req: Request, res: Response) => {
      const errorMessage =
        req.query.err === 'internal_server_error'
          ? 'Internal server error. Please try again.'
          : '';
      res.render('index', { errorMessage });
    });

    return router;
  },
};

export default coreModule;
