import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import {
  FileTooLargeError,
  RequestValidationError,
  UnsupportedFileError,
} from '../../common/errors/app-error.js';
import { uuidv7 } from '../../common/utils/uuid7.js';
import { msg } from '../../common/i18n/message.js';

export const UPLOAD_URL_PREFIX = '/uploads';

/** Allowed sub-folders (never built from user input). */
export type UploadFolder = 'products' | 'categories' | 'stores' | 'users' | 'owners' | 'customers';

/**
 * Image uploads on the local disk, served at /uploads.
 * The database stores only the URL path: "/uploads/products/<uuid7>.png".
 *
 * Safety:
 *   * type detected from the file's MAGIC BYTES, not its name / Content-Type
 *   * only JPEG / PNG / WEBP / GIF, max MAX_UPLOAD_SIZE_MB
 *   * the file name is generated (UUIDv7): no "../" tricks, no overwrites
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly root: string;

  constructor(private readonly config: AppConfig) {
    this.root = resolve(config.upload.dir);
    mkdirSync(this.root, { recursive: true });
  }

  private detectImage(head: Buffer): string | null {
    if (head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
    if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') {
      return 'webp';
    }
    const gif = head.subarray(0, 6).toString('latin1');
    if (gif === 'GIF87a' || gif === 'GIF89a') return 'gif';
    return null;
  }

  /** Validate and store an uploaded image. Returns its URL path for the database. */
  async saveImage(file: Express.Multer.File | undefined, folder: UploadFolder): Promise<string> {
    if (!file) throw new RequestValidationError([{ loc: ['body', 'file'], msg: 'Field required', type: 'missing' }]);
    const { maxBytes, maxMb } = this.config.upload;
    if (file.size > maxBytes) throw new FileTooLargeError(msg`File is larger than ${maxMb} MB`);
    if (file.size === 0) throw new UnsupportedFileError('The file is empty');
    const ext = this.detectImage(file.buffer.subarray(0, 12));
    if (!ext) throw new UnsupportedFileError('Only JPEG, PNG, WEBP or GIF images are allowed');

    const directory = resolve(this.root, folder);
    mkdirSync(directory, { recursive: true });
    const name = `${uuidv7()}.${ext}`;
    await writeFile(resolve(directory, name), file.buffer);
    this.logger.log(`Saved upload ${folder}/${name} (${file.size} bytes)`);
    return `${UPLOAD_URL_PREFIX}/${folder}/${name}`;
  }

  /** Delete a file we stored. Ignores external URLs, missing files and anything outside the uploads folder. */
  async deleteFile(urlPath: string | null | undefined): Promise<void> {
    if (!urlPath || !urlPath.startsWith(`${UPLOAD_URL_PREFIX}/`)) return;
    const target = resolve(this.root, urlPath.slice(UPLOAD_URL_PREFIX.length + 1));
    const rel = relative(this.root, target);
    if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return;
    try {
      await unlink(target);
      this.logger.log(`Deleted upload ${urlPath}`);
    } catch {
      /* already gone */
    }
  }

  /** After a committed update: if the image changed, delete the OLD uploaded file. */
  async cleanupReplaced(oldPath: string | null | undefined, newPath: string | null | undefined): Promise<void> {
    if (oldPath !== newPath) await this.deleteFile(oldPath);
  }

  /**
   * Save a new image and point a record at it:
   *   1. save the file      2. persist(path) in the database
   *   persist fails -> delete the NEW file (DB still points at the old one)
   *   persist OK    -> delete the OLD file
   * So the database never points at a file that doesn't exist.
   */
  async replaceImage<T>(
    file: Express.Multer.File | undefined,
    folder: UploadFolder,
    oldPath: string | null,
    persist: (path: string) => Promise<T>,
  ): Promise<T> {
    const newPath = await this.saveImage(file, folder);
    let result: T;
    try {
      result = await persist(newPath);
    } catch (err) {
      await this.deleteFile(newPath);
      throw err;
    }
    await this.cleanupReplaced(oldPath, newPath);
    return result;
  }
}
