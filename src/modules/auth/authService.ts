import bcrypt from 'bcrypt';
import session from 'express-session';
import { PrismaClient } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { Module } from '../../handlers/moduleInit';
import logger from '../../handlers/logger';

const prisma = new PrismaClient();

declare module 'express-session' {
  interface SessionData {
    user: {
      id: number;
      email: string;
      isAdmin: boolean;
      username: string;
      description: string;
    };
  }
}

const authServiceModule: Module = {
  info: {
    name: 'Auth System Module',
    description: 'This file is for authentication and authorization of users.',
    version: '1.0.0',
    moduleVersion: '1.0.0',
    author: 'AirLinkLab',
    license: 'MIT',
  },

  router: () => {
    const router = Router();

    const handleLogin = async (identifier: string, password: string) => {
      try {
        const user = await prisma.users.findFirst({
          where: { OR: [{ email: identifier }, { username: identifier }] },
        });

        if (!user) {
          return { success: false, error: 'user_not_found' };
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        return isPasswordValid
          ? { success: true, user }
          : { success: false, error: 'incorrect_password' };
      } catch (error) {
        logger.error('Database error:', error);
        return { success: false, error: 'database_error' };
      }
    };

    router.post('/login', async (req: Request, res: Response) => {
      const {
        identifier,
        password,
      }: { identifier: string; password: string } = req.body;

      const identifierRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$|^[a-zA-Z0-9]{3,20}$/;
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

      if (!identifier || !password) {
        return res.redirect('/login?err=missing_credentials');
      }

      if (!identifierRegex.test(identifier)) {
        return res.redirect('/login?err=invalid_identifier');
      }

      if (!passwordRegex.test(password)) {
        return res.redirect('/login?err=weak_password');
      }

      try {
        const result = await handleLogin(identifier, password);
        if (result.success && result.user) {
          if (result.user.username && result.user.description) {
            req.session.user = {
              id: result.user.id,
              email: result.user.email,
              isAdmin: result.user.isAdmin,
              description: result.user.description,
              username: result.user.username,
            };
          }
          res.redirect('/dashboard');
          return;
        }
        res.redirect(`/login?err=${result.error}`);
        return;
      } catch (error) {
        logger.error('Login error:', error);
        res.status(500).send('Server error. Please try again later.');
      }
    });

    router.post('/register', async (req: Request, res: Response) => {
      const { email, username, password } = req.body;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

      if (!email || !username || !password) {
        res.redirect('/register?err=missing_credentials');
        return;
      }

      if (!emailRegex.test(email)) {
        res.redirect('/register?err=invalid_email');
        return;
      }

      if (!usernameRegex.test(username)) {
        res.redirect('/register?err=invalid_username');
        return;
      }

      if (!passwordRegex.test(password)) {
        res.redirect('/register?err=weak_password');
        return;
      }

      try {
        const existingUser = await prisma.users.findFirst({
          where: { OR: [{ email }, { username }] },
        });

        if (existingUser) {
          res.redirect('/register?err=user_already_exists');
          return;
        }

        const userCount = await prisma.users.count();
        const isFirstUser = userCount === 0;

        await prisma.users.create({
          data: {
            email,
            username,
            password: await bcrypt.hash(password, 10),
            description: 'No About Me',
            isAdmin: isFirstUser
          },
        });
        res.redirect('/login');
      } catch (error) {
        logger.error('Database error:', error);
        res.status(500).send('Server error. Please try again later.');
      }
    });

    return router;
  },
};

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

export default authServiceModule;
