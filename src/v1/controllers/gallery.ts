import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { uploadFile, getSignedUrl } from '../../lib/supabase';
import fs from 'fs';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export async function uploadGalleryItem(req: MulterRequest, res: Response) {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Check if organization exists
    const organization = await prisma.organizations.findUnique({
      where: { id },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Upload to Supabase
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `gallery/${id}/${fileName}`;
    
    // Read file from disk (multer saves it to temp)
    const fileBuffer = fs.readFileSync(file.path);
    
    const uploadedPath = await uploadFile(filePath, fileBuffer, file.mimetype);

    // Clean up temp file
    fs.unlinkSync(file.path);

    if (!uploadedPath) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file to storage',
      });
    }

    // Create gallery item
    const galleryItem = await prisma.gallery_items.create({
      data: {
        organization_id: id,
        type: file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE',
        path: uploadedPath,
      },
    });

    // Generate signed URL
    const signedUrl = await getSignedUrl(uploadedPath);

    return res.json({
      success: true,
      data: {
        ...galleryItem,
        signed_url: signedUrl,
      },
      message: 'Gallery item uploaded successfully',
    });

  } catch (error) {
    console.error('Error uploading gallery item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload gallery item',
    });
  }
}

export async function getGallery(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if organization exists
    const organization = await prisma.organizations.findUnique({
      where: { id },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Fetch gallery items
    const items = await prisma.gallery_items.findMany({
      where: { organization_id: id },
      orderBy: { created_at: 'desc' },
    });

    // Generate signed URLs for all items
    const itemsWithUrls = await Promise.all(
      items.map(async (item) => {
        const signedUrl = await getSignedUrl(item.path);
        return {
          ...item,
          signed_url: signedUrl,
        };
      })
    );

    return res.json({
      success: true,
      data: itemsWithUrls,
    });

  } catch (error) {
    console.error('Error fetching gallery:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery',
    });
  }
}
