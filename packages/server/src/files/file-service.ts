import { randomUUID } from "node:crypto";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { CosFileSigner, FILE_URL_TTL_SECONDS, type FileSigner } from "./cos-client";

const ALLOWED_UPLOAD_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type ParentProfileRecord = { id: string; userId: string };
type ChildRecord = { id: string; parentProfileId: string; deletedAt: Date | null };

export type FileObjectRecord = {
  id: string;
  ownerUserId: string;
  parentProfileId: string | null;
  childId: string | null;
  objectKey: string;
  contentType: string;
  byteSize: number;
  status: "ACTIVE" | "DELETED" | "REVOKED";
  deletedAt: Date | null;
  revokedAt: Date | null;
};

type TransactionClient = {
  parentProfile: {
    findUnique(args: { where: { userId: string } }): Promise<ParentProfileRecord | null>;
  };
  child: {
    findUnique(args: { where: { id: string } }): Promise<ChildRecord | null>;
  };
  fileObject: {
    create(args: {
      data: {
        id: string;
        ownerUserId: string;
        parentProfileId: string;
        childId: string;
        objectKey: string;
        contentType: string;
        byteSize: number;
        purpose: "ASSESSMENT_UPLOAD";
        status: "ACTIVE";
      };
    }): Promise<FileObjectRecord>;
    findUnique(args: { where: { id: string } }): Promise<FileObjectRecord | null>;
  };
};

export interface FileServiceDatabase {
  $transaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

export type UploadInput = {
  contentType: string;
  byteSize: number;
};

export class FileService {
  constructor(
    private readonly database: FileServiceDatabase = prisma as unknown as FileServiceDatabase,
    private readonly signer: FileSigner = new CosFileSigner(),
    private readonly dependencies: { createId: () => string } = { createId: randomUUID },
  ) {}

  async issueUpload(userId: string, childId: string, input: UploadInput) {
    this.validateUpload(input);
    const file = await this.database.$transaction(async (tx) => {
      const parent = await this.requireParent(tx, userId);
      await this.requireOwnedChild(tx, parent.id, childId);
      const fileId = this.dependencies.createId();
      const objectKey = `families/${parent.id}/children/${childId}/ASSESSMENT_UPLOAD/${fileId}`;

      return tx.fileObject.create({
        data: {
          id: fileId,
          ownerUserId: userId,
          parentProfileId: parent.id,
          childId,
          objectKey,
          contentType: input.contentType,
          byteSize: input.byteSize,
          purpose: "ASSESSMENT_UPLOAD",
          status: "ACTIVE",
        },
      });
    });

    const uploadUrl = await this.signer.signPut({
      objectKey: file.objectKey,
      contentType: file.contentType,
      contentLength: file.byteSize,
      expiresInSeconds: FILE_URL_TTL_SECONDS,
    });
    return { fileId: file.id, uploadUrl, expiresInSeconds: FILE_URL_TTL_SECONDS };
  }

  async issueDownload(userId: string, fileId: string) {
    const file = await this.database.$transaction(async (tx) => {
      const parent = await this.requireParent(tx, userId);
      const fileObject = await tx.fileObject.findUnique({ where: { id: fileId } });
      if (!fileObject) throw new AppError("NOT_FOUND", 404, "File not found");
      if (fileObject.ownerUserId !== userId || fileObject.parentProfileId !== parent.id) {
        throw new AppError("FORBIDDEN", 403, "You cannot access this file");
      }
      if (
        fileObject.status !== "ACTIVE"
        || fileObject.deletedAt
        || fileObject.revokedAt
        || !fileObject.childId
      ) {
        throw new AppError("NOT_FOUND", 404, "File not found");
      }
      await this.requireOwnedChild(tx, parent.id, fileObject.childId);
      return fileObject;
    });

    const downloadUrl = await this.signer.signGet({
      objectKey: file.objectKey,
      expiresInSeconds: FILE_URL_TTL_SECONDS,
    });
    return { downloadUrl, expiresInSeconds: FILE_URL_TTL_SECONDS };
  }

  private validateUpload(input: UploadInput) {
    if (
      !ALLOWED_UPLOAD_CONTENT_TYPES.has(input.contentType)
      || !Number.isInteger(input.byteSize)
      || input.byteSize <= 0
      || input.byteSize > MAX_UPLOAD_BYTES
    ) {
      throw new AppError("VALIDATION_ERROR", 400, "Unsupported assessment upload");
    }
  }

  private async requireParent(tx: TransactionClient, userId: string): Promise<ParentProfileRecord> {
    const parent = await tx.parentProfile.findUnique({ where: { userId } });
    if (!parent) throw new AppError("NOT_FOUND", 404, "Parent profile not found");
    return parent;
  }

  private async requireOwnedChild(tx: TransactionClient, parentProfileId: string, childId: string): Promise<ChildRecord> {
    const child = await tx.child.findUnique({ where: { id: childId } });
    if (!child || child.deletedAt) throw new AppError("NOT_FOUND", 404, "Child not found");
    if (child.parentProfileId !== parentProfileId) {
      throw new AppError("FORBIDDEN", 403, "You cannot access this child");
    }
    return child;
  }
}

export type { FileSigner } from "./cos-client";
