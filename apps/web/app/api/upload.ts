import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileString = `data:${file.type};base64,${buffer.toString('base64')}`;

    
    const result = await cloudinary.uploader.upload(fileString, {
      folder: 'tickets',
      resource_type: 'auto',
    });

    return NextResponse.json({ fileUrl: result.secure_url });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}