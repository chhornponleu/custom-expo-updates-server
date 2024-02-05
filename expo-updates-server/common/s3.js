const AWS = require('@aws-sdk/client-s3');
const bucket = 'test-expo-updates';

const client = new AWS.S3Client({
    region: 'ap-southeast-1',
    credentials: {
        accessKeyId: 'AKIA5CDBCTP5NEDYD2V7',
        secretAccessKey: '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'
    }
})

const s3 = {
    async uploadToS3({ path, file }) {
        const command = new AWS.PutObjectCommand({
            Bucket: bucket,
            Key: path,
            Prefix: path,
            Body: file,
        });
        return client.send(command)
    },
    async deleteFromS3({ path }) {
        const command = new AWS.DeleteObjectCommand({
            Bucket: bucket,
            Key: path,
        });
        return client.send(command)
    },
    async listS3({ path }) {
        const command = new AWS.ListObjectsCommand({
            Bucket: bucket,
            Prefix: path,

        });
        return client.send(command)
    },
    async getFromS3({ path }) {
        const command = new AWS.GetObjectCommand({
            Bucket: bucket,
            Key: path,
        });
        return client.send(command)
    },
    async copyS3({ from, to }) {
        const command = new AWS.CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${from}`,
            Key: to,
        });
        return client.send(command)
    },
    async moveS3({ from, to }) {
        await this.copyS3({ from, to });
        await this.deleteFromS3({ path: from });
    },
}

module.exports = s3