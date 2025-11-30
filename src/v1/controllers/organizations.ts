import { Response } from 'express';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth';

// Helper function to generate a slug from organization name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createOrganization(req: AuthRequest, res: Response) {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Organization name is required',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Generate unique slug
    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    // Check if slug already exists and make it unique
    while (await prisma.organizations.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create organization
    const organization = await prisma.organizations.create({
      data: {
        name,
        slug,
      },
    });

    // Add user as admin of the organization
    await prisma.user_organizations.create({
      data: {
        user_id: req.user.id,
        organization_id: organization.id,
        role: 'ADMIN',
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          created_at: organization.created_at,
          updated_at: organization.updated_at,
        },
      },
      message: 'Organization created successfully',
    });
  } catch (error) {
    console.error('Error in createOrganization:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getUserOrganizations(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const userOrganizations = await prisma.user_organizations.findMany({
      where: {
        user_id: req.user.id,
      },
      include: {
        organization: true,
      },
    });

    return res.json({
      success: true,
      data: {
        organizations: userOrganizations.map((uo) => ({
          id: uo.organization.id,
          name: uo.organization.name,
          slug: uo.organization.slug,
          role: uo.role,
          created_at: uo.organization.created_at,
          updated_at: uo.organization.updated_at,
        })),
      },
      message: 'Organizations fetched successfully',
    });
  } catch (error) {
    console.error('Error in getUserOrganizations:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}
