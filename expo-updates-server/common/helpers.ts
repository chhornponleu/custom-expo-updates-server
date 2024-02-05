import crypto, { BinaryToTextEncoding } from 'crypto';
import fsSync from 'fs';
import fs from 'fs/promises';
import mime from 'mime';
import path from 'path';
import { Dictionary } from 'structured-headers';
import * as s3 from './s3';
import { ListObjectsCommandOutput } from '@aws-sdk/client-s3';

export class NoUpdateAvailableError extends Error { }

function createHash(file: Buffer, hashingAlgorithm: string, encoding: BinaryToTextEncoding) {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding);
}

function getBase64URLEncoding(base64EncodedString: string): string {
  return base64EncodedString.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function convertToDictionaryItemsRepresentation(obj: { [key: string]: string }): Dictionary {
  return new Map(
    Object.entries(obj).map(([k, v]) => {
      return [k, [v, new Map()]];
    })
  );
}

export function signRSASHA256(data: string, privateKey: string) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data, 'utf8');
  sign.end();
  return sign.sign(privateKey, 'base64');
}

export async function getPrivateKeyAsync() {
  const privateKeyPath = process.env.PRIVATE_KEY_PATH;
  if (!privateKeyPath) {
    return null;
  }
  const pemBuffer = await fs.readFile(path.resolve(privateKeyPath));
  return pemBuffer.toString('utf8');
}

export async function getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion: string) {
  const updatesDirectoryForRuntimeVersion = `expo-updates-client/updates/${runtimeVersion}`;
  const dirList = `${updatesDirectoryForRuntimeVersion}/list/`
  // if (!fsSync.existsSync(updatesDirectoryForRuntimeVersion)) {
  //   throw new Error('Unsupported runtime version');
  // }


  // const filesInUpdatesDirectory = await fs.readdir(updatesDirectoryForRuntimeVersion);
  // const directoriesInUpdatesDirectory = (
  //   await Promise.all(
  //     filesInUpdatesDirectory.map(async (file) => {
  //       const fileStat = await fs.stat(path.join(updatesDirectoryForRuntimeVersion, file));
  //       return fileStat.isDirectory() ? file : null;
  //     })
  //   )
  // )
  //   .filter(truthy)
  //   .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  // return path.join(updatesDirectoryForRuntimeVersion, directoriesInUpdatesDirectory[0]);
  const start = Date.now();
  const filesInUpdatesDirectory: ListObjectsCommandOutput = await s3.listS3({ path: dirList });
  console.log(`time::: getLatestUpdateBundlePathForRuntimeVersionAsync: ${Date.now() - start}ms`, updatesDirectoryForRuntimeVersion);

  const folders = filesInUpdatesDirectory.Contents?.map(item => {
    console.log(item.Key);
    let k = item.Key || '';
    k = k.replace(dirList, '');
    return k;
  }) || []

  if (folders.length === 0) {
    throw new Error('Unsupported runtime version');
  }

  const directoriesInUpdatesDirectory = folders
    .filter(truthy)
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

  console.log('directoriesInUpdatesDirectory', directoriesInUpdatesDirectory)

  return path.join(updatesDirectoryForRuntimeVersion, directoriesInUpdatesDirectory[0]);
}

type GetAssetMetadataArg =
  | {
    updateBundlePath: string;
    filePath: string;
    ext: null;
    isLaunchAsset: true;
    runtimeVersion: string;
    platform: string;
  }
  | {
    updateBundlePath: string;
    filePath: string;
    ext: string;
    isLaunchAsset: false;
    runtimeVersion: string;
    platform: string;
  };

export async function getAssetMetadataAsync(arg: GetAssetMetadataArg) {
  const assetFilePath = `${arg.updateBundlePath}/${arg.filePath}`;
  // const asset = await fs.readFile(path.resolve('..', 's3', assetFilePath), null);//TODO: path
  // const assetHash = getBase64URLEncoding(createHash(asset, 'sha256', 'base64'));
  const start = Date.now();
  const asset = Buffer.from(
    await (await s3.getFromS3({ path: assetFilePath })).Body?.transformToByteArray() || ''
  )
  console.log(`time::: getAssetMetadataAsync: ${Date.now() - start}ms`, assetFilePath);

  const key = createHash(asset, 'md5', 'hex');
  const assetHash = getBase64URLEncoding(createHash(asset, 'sha256', 'base64'));
  const keyExtensionSuffix = arg.isLaunchAsset ? 'bundle' : arg.ext;
  const contentType = arg.isLaunchAsset ? 'application/javascript' : mime.getType(arg.ext);
  // const prefix = 'http://192.168.31.90:8080z'
  const prefix = 'https://test-expo-updates.s3.ap-southeast-1.amazonaws.com';
  return {
    hash: assetHash,
    key,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    // url: `${process.env.HOSTNAME}/api/assets?asset=${assetFilePath}&runtimeVersion=${arg.runtimeVersion}&platform=${arg.platform}`,
    url: `${prefix}/${assetFilePath}`,

  };
}

export async function createRollBackDirectiveAsync(updateBundlePath: string) {
  try {
    const rollbackFilePath = `${updateBundlePath}/rollback`;
    const rollbackFileStat = await fs.stat(rollbackFilePath);
    return {
      type: 'rollBackToEmbedded',
      parameters: {
        commitTime: new Date(rollbackFileStat.birthtime).toISOString(),
      },
    };
  } catch (error) {
    throw new Error(`No rollback found. Error: ${error}`);
  }
}

export async function createNoUpdateAvailableDirectiveAsync() {
  return {
    type: 'noUpdateAvailable',
  };
}

export async function getMetadataAsync({
  updateBundlePath,
  runtimeVersion,
}: {
  updateBundlePath: string;
  runtimeVersion: string;
}) {
  try {
    const metadataPath = `${updateBundlePath}/metadata.json`;
    // const updateMetadataBuffer = await fs.readFile(path.resolve(metadataPath), null);
    const start = Date.now();
    const file = await s3.getFromS3({ path: metadataPath })
    console.log(`time::: getMetadataAsync: ${Date.now() - start}ms`);

    const updateMetadataBuffer = Buffer.from(
      await (file).Body?.transformToByteArray() || ''
    )
    const metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'));
    // const metadataStat = await fs.stat(metadataPath);

    return {
      metadataJson,
      createdAt: file.LastModified?.toISOString(), //new Date(metadataStat.birthtime).toISOString(),
      id: createHash(updateMetadataBuffer, 'sha256', 'hex'),
    };
  } catch (error) {
    throw new Error(`No update found with runtime version: ${runtimeVersion}. Error: ${error}`);
  }
}

/**
 * This adds the `@expo/config`-exported config to `extra.expoConfig`, which is a common thing
 * done by implementors of the expo-updates specification since a lot of Expo modules use it.
 * It is not required by the specification, but is included here in the example client and server
 * for demonstration purposes. EAS Update does something conceptually very similar.
 */
export async function getExpoConfigAsync({
  updateBundlePath,
  runtimeVersion,
}: {
  updateBundlePath: string;
  runtimeVersion: string;
}): Promise<any> {
  try {
    const expoConfigPath = `${updateBundlePath}/expoConfig.json`;
    // const expoConfigBuffer = await fs.readFile(path.resolve(expoConfigPath), null);
    // const expoConfigJson = JSON.parse(expoConfigBuffer.toString('utf-8'));
    const start = Date.now();
    const file = await (await s3.getFromS3({ path: expoConfigPath })).Body?.transformToString('utf-8');
    console.log(`time::: getExpoConfigAsync: ${Date.now() - start}ms`);

    const expoConfigJson = JSON.parse(file || '');
    return expoConfigJson;
  } catch (error) {
    throw new Error(
      `No expo config json found with runtime version: ${runtimeVersion}. Error: ${error}`
    );
  }
}

export function convertSHA256HashToUUID(value: string) {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(
    16,
    20
  )}-${value.slice(20, 32)}`;
}

export function truthy<TValue>(value: TValue | null | undefined): value is TValue {
  return !!value;
}
