import { AppError, CosFileSigner, ReportShareService } from "@lightning-tiger/server";
import { NextResponse } from "next/server";

const shares = new ReportShareService();
const signer = new CosFileSigner();

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token) throw new AppError("NOT_FOUND", 404, "Share link not found");
    const download = await shares.resolveDownload(token, signer);
    return NextResponse.redirect(download.downloadUrl, 302);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: "Share link not found" }, { status: status === 500 ? 500 : 404 });
  }
}
