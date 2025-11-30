import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

export async function listUsers(req: Request, res: Response) {
  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        created_at: true,
        updated_at: true,
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return res.json({
      success: true,
      data: users,
      message: 'Users fetched successfully',
    });
  } catch (error) {
    console.error('Error in listUsers:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}
