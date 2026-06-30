import { v2 as cloudinary } from 'cloudinary';

export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );

export const configureCloudinary = () => {
  if (!isCloudinaryConfigured()) return false;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
    secure: true,
  });
  return true;
};

/**
 * @param {Buffer} buffer
 * @param {{ folder?: string; publicId?: string }} [opts]
 */
export const uploadAvatarBuffer = (buffer, opts = {}) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder || 'doan-avatars',
        public_id: opts.publicId,
        resource_type: 'image',
        transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'face' }],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    uploadStream.end(buffer);
  });

export const destroyCloudinaryAsset = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (e) {
    console.error('Cloudinary destroy failed:', e?.message || e);
  }
};

/**
 * @param {Buffer} buffer
 * @param {{ folder?: string; publicId?: string; resourceType?: string; contentDisposition?: string }} [opts]
 */
export const uploadFileBuffer = (buffer, opts = {}) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder || 'doan-chat-attachments',
        public_id: opts.publicId,
        resource_type: opts.resourceType || 'auto',
        content_disposition: opts.contentDisposition,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    uploadStream.end(buffer);
  });

export const getSignedUrl = (publicId, resourceType = 'raw') => {
  if (!publicId || !isCloudinaryConfigured()) return '';
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    secure: true,
    sign_url: true,
  });
};
