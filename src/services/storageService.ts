import fs from 'fs';
import path from 'path';
import axios from 'axios';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const RAW_BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BASE_URL = RAW_BASE_URL.endsWith('/') ? RAW_BASE_URL.slice(0, -1) : RAW_BASE_URL;

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Upload a file buffer to local storage.
 * In production, replace with S3/MinIO upload.
 * 
 * @param buffer - File content as Buffer
 * @param filename - Name to save the file as
 * @param mimeType - MIME type of the file
 * @returns Public URL to access the file
 */
export async function uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string
): Promise<string> {
    try {
        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const ext = getExtensionFromMimeType(mimeType);
        const uniqueFilename = `${timestamp}_${filename}${ext}`;

        const filePath = path.join(UPLOADS_DIR, uniqueFilename);

        // Write file to disk
        await fs.promises.writeFile(filePath, buffer);

        console.log(`📁 File saved: ${uniqueFilename} (${buffer.length} bytes)`);

        // Return public URL
        return `${BASE_URL}/uploads/${uniqueFilename}`;
    } catch (error) {
        console.error('❌ Error writing file to disk:', error);
        throw new Error('Storage write failure');
    }
}

/**
 * Download an image from Meta's servers and save it locally.
 * Meta's image URLs are temporary, so we must download immediately.
 * 
 * @param mediaId - Meta's media ID
 * @param accessToken - WhatsApp API access token
 * @returns Public URL to our stored file
 */
export async function downloadAndSaveMetaImage(
    mediaId: string,
    accessToken: string
): Promise<string> {
    try {
        console.log(`🔍 [Meta] Fetching metadata for media: ${mediaId}`);

        // Step 1: Get the temporary download URL from Meta
        const mediaInfoUrl = `https://graph.facebook.com/v21.0/${mediaId}`;

        let mediaInfoResponse;
        try {
            mediaInfoResponse = await axios.get(mediaInfoUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
        } catch (err: any) {
            console.error(`❌ [Meta] Failed to get media metadata: ${err.response?.status} - ${err.message}`);
            if (err.response?.data) console.error('Data:', JSON.stringify(err.response.data));
            throw new Error(`Meta metadata fetch failed: ${err.message}`);
        }

        const downloadUrl = mediaInfoResponse.data.url;
        const mimeType = mediaInfoResponse.data.mime_type || 'image/jpeg';

        console.log(`📥 [Meta] Media URL found. Downloading binary (MIME: ${mimeType})...`);

        // Step 2: Download the actual image with Authorization header
        let imageResponse;
        try {
            imageResponse = await axios.get(downloadUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'User-Agent': 'AutoWhats-Bot/1.0'
                },
                responseType: 'arraybuffer'
            });
            console.log(`✅ [Meta] Download successful (${imageResponse.data.byteLength} bytes)`);
        } catch (err: any) {
            console.error(`❌ [Meta] Binary download failed: ${err.response?.status} - ${err.message}`);
            if (err.response?.status === 403) {
                console.error('💡 TIP: Meta returned 403 Forbidden. Ensure the Authorization header is present and the token is valid.');
            }
            throw new Error(`Meta binary download failed: ${err.message}`);
        }

        const buffer = Buffer.from(imageResponse.data);

        // Step 3: Save to our storage
        const filename = `attendance_${mediaId}`;
        const publicUrl = await uploadFile(buffer, filename, mimeType);

        return publicUrl;
    } catch (error: any) {
        console.error('❌ [StorageService] Error:', error.message);
        throw error;
    }
}

/**
 * Get file extension from MIME type.
 */
function getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/heic': '.heic',
        'image/heif': '.heif'
    };

    return mimeToExt[mimeType] || '.jpg';
}
