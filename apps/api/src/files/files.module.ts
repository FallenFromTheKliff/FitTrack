import { Module } from '@nestjs/common';

import { FilesController } from './files.controller';
import { FILES_STORAGE } from './files.constants';
import { FilesService } from './files.service';
import { R2UploadGuardService } from './r2-upload-guard.service';
import { R2StorageService } from './r2-storage.service';

@Module({
  controllers: [FilesController],
  providers: [
    FilesService,
    R2UploadGuardService,
    R2StorageService,
    {
      provide: FILES_STORAGE,
      useExisting: R2StorageService,
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}
