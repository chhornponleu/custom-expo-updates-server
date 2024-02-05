
const fs = require('fs');
const AWS = require('@aws-sdk/client-s3');
const bucket = 'test-expo-updates';

const client = new AWS.S3Client({
    region: 'ap-southeast-1',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
})
// const body = fs.readFileSync('./dist/metadata.json');

const s3 = {
    async uploadToS3({ path, file }) {
        const command = new AWS.PutObjectCommand({
            Bucket: bucket,
            Key: path,
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

// s3.listS3({ path: 'updates/1' }).then(console.log).catch(console.error);

module.exports = s3;