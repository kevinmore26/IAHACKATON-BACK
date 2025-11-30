import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import prisma from '../lib/prisma';

interface AppUser {
  id: string;
  name: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthRequest extends Request {
  user?: AppUser & { jwt: string };
}

export async function verifyUserToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.headers['authorization'];

  if (!token)
    return res.status(403).json({
      message: 'No token provided',
      success: false,
    });

  try {
    // Verify token with the secret from .env
    const tokenWithoutBearer = token?.split(' ')[1];

    const decoded = jwt.verify(
      tokenWithoutBearer,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    const user = await prisma.users.findUnique({
      where: {
        id: decoded.id as string,
      },
    });

    if (!user)
      return res
        .status(404)
        .json({ message: 'User not found', success: false });

    req.user = {
      ...user,
      jwt: tokenWithoutBearer,
    };

    return next();
  } catch (error: any) {
    // if jwt.verify fails, it throws an error but we don't want to use the handleError if it's a jwt error
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Failed to authenticate token',
      });
    }

    console.error('Error in middleware.verifyUserToken:', error);

    return res.status(500).send({
      message: 'Failed to authenticate token',
      success: false,
    });
  }
}
