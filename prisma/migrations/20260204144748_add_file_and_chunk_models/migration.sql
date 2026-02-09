-- CreateTable
CREATE TABLE "files" (
    "FileID" SERIAL NOT NULL,
    "UserID" INTEGER NOT NULL,
    "FileName" TEXT NOT NULL,
    "FileType" TEXT NOT NULL,
    "FileSize" INTEGER NOT NULL,
    "TotalChunks" INTEGER NOT NULL DEFAULT 0,
    "Status" TEXT NOT NULL DEFAULT 'processing',
    "UploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ProcessedAt" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("FileID")
);

-- CreateTable
CREATE TABLE "file_chunks" (
    "ChunkID" SERIAL NOT NULL,
    "FileID" INTEGER NOT NULL,
    "ChunkIndex" INTEGER NOT NULL,
    "Content" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_chunks_pkey" PRIMARY KEY ("ChunkID")
);

-- CreateIndex
CREATE INDEX "files_UserID_idx" ON "files"("UserID");

-- CreateIndex
CREATE INDEX "files_Status_idx" ON "files"("Status");

-- CreateIndex
CREATE INDEX "file_chunks_FileID_idx" ON "file_chunks"("FileID");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_UserID_fkey" FOREIGN KEY ("UserID") REFERENCES "users"("UserID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_FileID_fkey" FOREIGN KEY ("FileID") REFERENCES "files"("FileID") ON DELETE CASCADE ON UPDATE CASCADE;
