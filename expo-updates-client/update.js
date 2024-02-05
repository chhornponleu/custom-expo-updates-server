#!/usr/bin/env node
// const yargs = require('yargs/yargs')
// const { hideBin } = require('yargs/helpers')
// const argv = yargs(hideBin(process.argv)).argv
// console.log(argv);

const { exec } = require('child_process');
const fse = require('fs-extra');
const { uploadToS3 } = require('./s3');

function bundleApp() {
    return new Promise((resolve, reject) => {
        const exportCli = `rm -rf dist && yarn install && npx expo export`;
        exec(exportCli, (err, stdout, stderr) => {
            if (err) {
                // node couldn't execute the command
                console.log(err);
                reject(err);
                return;
            }
            resolve({ stdout, stderr })
            // the *entire* stdout and stderr (buffered)
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
        });
    })
}


function getAppConfig() {
    return new Promise(async (resolve, reject) => {
        try {
            const ExpoConfig = require('@expo/config');
            const path = require('path');

            const projectDir = path.join(__dirname);

            const { exp } = ExpoConfig.getConfig(projectDir, {
                skipSDKVersionRequirement: true,
                isPublicConfig: true,
            });
            resolve(exp)
        }
        catch (e) {
            reject(e);
        }
    })

}

bundleApp().then(() => {
    getAppConfig().then(async appjson => {
        const app = 'expo-updates-client'
        const channel = 'dev'
        const runtimeDir = `${app}/${channel}/updates/${appjson.runtimeVersion}`
        const uploadDir = `${Math.floor(Date.now() / 1000)}`
        const bundlePath = `${runtimeDir}/${uploadDir}`

        console.log('uploading bundle: ', uploadDir)

        //metajson
        const metajson = fse.readJsonSync('./dist/metadata.json');
        await uploadToS3({ path: `${bundlePath}/metadata.json`, file: fse.readFileSync('./dist/metadata.json') });
        //TODO: consider pregenerate file hash as mentioned in helpers->getAssetMetadataAsync

        //expoConfig.json
        fse.writeJsonSync('./dist/expoConfig.json', appjson);// optional
        await uploadToS3({ path: `${bundlePath}/expoConfig.json`, file: JSON.stringify(appjson) });

        //ios
        const ios = metajson.fileMetadata.ios;
        await uploadToS3({ path: `${bundlePath}/${ios.bundle}`, file: fse.readFileSync(`./dist/${ios.bundle}`) });
        ios.assets?.forEach(async asset => {
            await uploadToS3({ path: `${bundlePath}/${asset.path}`, file: fse.readFileSync(`./dist/${asset.path}`) });
        })

        //android
        const android = metajson.fileMetadata.android;
        await uploadToS3({ path: `${bundlePath}/${android.bundle}`, file: fse.readFileSync(`./dist/${android.bundle}`) });
        android.assets?.forEach(async asset => {
            await uploadToS3({ path: `${bundlePath}/${asset.path}`, file: fse.readFileSync(`./dist/${asset.path}`) });
        })


        // bump update filders
        // this shoudl be uploaded to last
        await uploadToS3({ path: `${runtimeDir}/list/${uploadDir}`, file: Buffer.from('') });

    })
})
