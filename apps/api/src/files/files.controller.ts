import {
  Controller,
  Get,
  Header,
  Query,
  Res,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/public.decorator/public.decorator';
import { JwtAuthGuard } from '../common/guards';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { FilesService } from './files.service';
import { UploadedImageFile, UploadedStorageFile } from './files.types';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload an image file to shared storage.' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully.' })
  @ApiResponse({
    status: 413,
    description: 'File exceeds the configured upload limit.',
  })
  uploadFile(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: UploadedImageFile | undefined,
  ) {
    return this.filesService.uploadImage(file, `uploads/${user.sub}`);
  }

  @Post('milestone-evidence')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload milestone proof evidence to shared storage.',
  })
  @ApiResponse({ status: 201, description: 'Evidence uploaded successfully.' })
  @ApiResponse({
    status: 413,
    description: 'File exceeds the configured milestone evidence limit.',
  })
  @ApiResponse({
    status: 415,
    description: 'Only JPEG, PNG, and MP4 evidence files are supported.',
  })
  uploadMilestoneEvidence(
    @UploadedFile() file: UploadedStorageFile | undefined,
  ) {
    return this.filesService.uploadMilestoneEvidence(file);
  }

  @Get('render')
  @Public()
  @ApiOperation({ summary: 'Render a stored image through the API.' })
  @ApiQuery({
    name: 'key',
    required: true,
    description: 'Storage object key, such as uploads/2026/04/avatar.png.',
  })
  @ApiResponse({ status: 200, description: 'Image streamed successfully.' })
  @ApiResponse({ status: 404, description: 'Image not found.' })
  @Header('access-control-allow-origin', '*')
  @Header('cache-control', 'public, max-age=300')
  @Header('cross-origin-resource-policy', 'cross-origin')
  async renderImage(@Query('key') key: string, @Res() response: Response) {
    const image = await this.filesService.renderImage(key);
    response.setHeader('content-type', image.contentType);
    if (image.contentLength) {
      response.setHeader('content-length', String(image.contentLength));
    }
    response.setHeader('x-fittrack-asset-key', image.key);
    response.send(image.body);
  }
}
