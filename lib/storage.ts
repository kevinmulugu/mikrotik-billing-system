/**
 * File Storage Utilities
 * 
 * This file provides file upload functionality for ticket attachments.
 * You can implement either AWS S3, Cloudinary, or local storage.
 */

import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'

// Type definitions
export interface UploadResult {
  url: string
  key: string
  size: number
  type: string
}

/**
 * LOCAL STORAGE IMPLEMENTATION
 * Store files in the public/uploads directory
 * Note: For production, use S3 or similar cloud storage
 */
export async function uploadToLocal(file: File): Promise<UploadResult> {
  try {
    // Generate unique filename
    const fileExtension = path.extname(file.name)
    const fileName = `${uuidv4()}${fileExtension}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tickets')
    const filePath = path.join(uploadDir, fileName)

    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true })

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Write file
    await fs.writeFile(filePath, buffer)

    return {
      url: `/uploads/tickets/${fileName}`,
      key: fileName,
      size: file.size,
      type: file.type,
    }
  } catch (error) {
    console.error('Error uploading file locally:', error)
    throw new Error('Failed to upload file')
  }
}

/**
 * AWS S3 IMPLEMENTATION
 * Uncomment and configure when ready to use S3
 */
/*
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

export async function uploadToS3(file: File): Promise<UploadResult> {
  try {
    const fileExtension = path.extname(file.name)
    const fileName = `tickets/${uuidv4()}${fileExtension}`
    
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || '',
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read', // or 'private' with signed URLs
    })

    await s3Client.send(command)

    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`

    return {
      url,
      key: fileName,
      size: file.size,
      type: file.type,
    }
  } catch (error) {
    console.error('Error uploading file to S3:', error)
    throw new Error('Failed to upload file to S3')
  }
}
*/

/**
 * CLOUDINARY IMPLEMENTATION
 * Uncomment and configure when ready to use Cloudinary
 */
/*
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function uploadToCloudinary(file: File): Promise<UploadResult> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const dataUri = `data:${file.type};base64,${base64}`

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'mikrotik-billing/tickets',
      resource_type: 'auto',
    })

    return {
      url: result.secure_url,
      key: result.public_id,
      size: result.bytes,
      type: file.type,
    }
  } catch (error) {
    console.error('Error uploading file to Cloudinary:', error)
    throw new Error('Failed to upload file to Cloudinary')
  }
}
*/

/**
 * Main upload function
 * Change this to use different storage providers
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  // Validate file
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    throw new Error('File size exceeds 5MB limit')
  }

  // Validate file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
  ]

  if (!allowedTypes.includes(file.type)) {
    throw new Error('File type not allowed')
  }

  // Use local storage by default
  // Change to uploadToS3(file) or uploadToCloudinary(file) when ready
  return uploadToLocal(file)
}

/**
 * Delete file from storage
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    // Local storage deletion
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'tickets', key)
    await fs.unlink(filePath)
  } catch (error) {
    console.error('Error deleting file:', error)
    // Don't throw error if file doesn't exist
  }
}

/**
 * Get file URL
 * For local storage, returns relative URL
 * For S3/Cloudinary, this might generate signed URLs
 */
export function getFileUrl(key: string): string {
  // For local storage
  return `/uploads/tickets/${key}`
  
  // For S3 with signed URLs:
  // return await getSignedUrl(s3Client, new GetObjectCommand({...}))
  
  // For Cloudinary:
  // return cloudinary.url(key)
}

/**
 * Helper to process multiple file uploads
 */
export async function uploadMultipleFiles(files: File[]): Promise<UploadResult[]> {
  const uploadPromises = files.map(file => uploadFile(file))
  return Promise.all(uploadPromises)
}