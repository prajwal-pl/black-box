import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION,
    credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY!,
        secretAccessKey: process.env.STORAGE_SECRET_KEY!,
    },
    forcePathStyle: true,
});

const bucketName = process.env.STORAGE_BUCKET!;

export class StorageService {
    static async upload(key: string, body: Buffer, mimeType: string) {
        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: body,
            ContentType: mimeType
        }))
        return key;
    }

    static async download(key: string): Promise<Buffer> {
        const res = await s3.send(new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        }))
        return Buffer.from(await res.Body!.transformToByteArray());
    }

    static async delete(key: string) {
        await s3.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key
        }))
    }

    static async getPresignedUrl(key: string, expiresIn: number = 3600) {
        return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName, Key: key }), { expiresIn })
    }
}