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

import { generateBusinessBrief } from '../../lib/ai';

export async function createOrganization(req: AuthRequest, res: Response) {
  try {
    const {
      name,
      business_type,
      main_product,
      content_objective,
      target_audience,
    } = req.body;

    if (
      !name ||
      !business_type ||
      !main_product ||
      !content_objective ||
      !target_audience
    ) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
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

    // Generate business brief using AI
    const business_brief = await generateBusinessBrief({
      name,
      business_type,
      main_product,
      content_objective,
      target_audience,
    });

    // Create organization
    const organization = await prisma.organizations.create({
      data: {
        name,
        slug,
        business_type,
        main_product,
        content_objective,
        target_audience,
        business_brief,
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
          business_type: organization.business_type,
          main_product: organization.main_product,
          content_objective: organization.content_objective,
          target_audience: organization.target_audience,
          business_brief: organization.business_brief,
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

import { generateContentIdeas } from '../../lib/ai';

export async function generateIdeas(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { count = 7 } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Check if user belongs to organization
    const userOrg = await prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: req.user.id,
          organization_id: id,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'User does not belong to this organization',
      });
    }

    const org = userOrg.organization;

    // Generate ideas using AI
    const ideas = await generateContentIdeas(
      {
        name: org.name,
        business_type: org.business_type || '',
        main_product: org.main_product || '',
        content_objective: org.content_objective || '',
        target_audience: org.target_audience || '',
        business_brief: org.business_brief || '',
      },
      count
    );

    // Save ideas to DB
    if (ideas.length > 0) {
      await prisma.content_ideas.createMany({
        data: ideas.map((idea) => ({
          organization_id: id,
          title: idea.title,
          script: idea.script,
        })),
      });
    }

    // Fetch created ideas (to get IDs)
    const createdIdeas = await prisma.content_ideas.findMany({
      where: {
        organization_id: id,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: count,
    });

    return res.status(201).json({
      success: true,
      data: {
        ideas: createdIdeas,
      },
      message: 'Content ideas generated successfully',
    });
  } catch (error) {
    console.error('Error in generateIdeas:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getHome(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Check if user belongs to organization
    const userOrg = await prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: req.user.id,
          organization_id: id,
        },
      },
    });

    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'User does not belong to this organization',
      });
    }

    const ideas = await prisma.content_ideas.findMany({
      where: {
        organization_id: id,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 10,
    });

    return res.json({
      success: true,
      data: {
        ideas,
      },
      message: 'Home data fetched successfully',
    });
  } catch (error) {
    console.error('Error in getHome:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

import { getSignedUrl } from '../../lib/supabase';

export async function getOrganizationVideos(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Check if user belongs to organization
    const userOrg = await prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: req.user.id,
          organization_id: id,
        },
      },
    });

    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'User does not belong to this organization',
      });
    }

    // Fetch last 20 content ideas with final videos
    const videos = await prisma.content_ideas.findMany({
      where: {
        organization_id: id,
        final_video_path: {
          not: null,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 20,
    });

    // Generate signed URLs in parallel
    const videosWithUrls = await Promise.all(
      videos.map(async (video) => {
        const signedUrl = video.final_video_path
          ? await getSignedUrl(video.final_video_path)
          : null;

        return {
          ...video,
          signed_url: signedUrl,
        };
      })
    );

    return res.json({
      success: true,
      data: {
        videos: videosWithUrls,
      },
      message: 'Videos fetched successfully',
    });
  } catch (error) {
    console.error('Error in getOrganizationVideos:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

export async function getOrganizationVoices(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Check if user belongs to organization
    const userOrg = await prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: req.user.id,
          organization_id: id,
        },
      },
    });

    if (!userOrg) {
      return res.status(403).json({
        success: false,
        message: 'User does not belong to this organization',
      });
    }

    // Fetch voices: Public (organization_id is null) OR belonging to this organization
    const voices = await prisma.voices.findMany({
      where: {
        OR: [
          { organization_id: null },
          { organization_id: id },
        ],
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.json({
      success: true,
      data: {
        voices,
      },
      message: 'Voices fetched successfully',
    });
  } catch (error) {
    console.error('Error in getOrganizationVoices:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}
