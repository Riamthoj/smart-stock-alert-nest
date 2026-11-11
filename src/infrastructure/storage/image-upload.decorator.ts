import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiResponse } from '@nestjs/swagger';

/**
 * multipart/form-data endpoint with ONE image in the field "file".
 * Size limit + in-memory storage come from the global MulterModule
 * (see infrastructure.module.ts), so a huge upload is cut off early.
 */
export function ImageUpload() {
  return applyDecorators(
    UseInterceptors(FileInterceptor('file')),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      required: true,
      schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
    }),
    ApiResponse({ status: 413, description: 'File too large' }),
    ApiResponse({ status: 415, description: 'Not a JPEG/PNG/WEBP/GIF image' }),
  );
}
