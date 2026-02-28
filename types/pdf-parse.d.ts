/**
 * AUTO-DOC: File overview
 * Purpose: Type augmentation file for external library compatibility.
 * Related pages/files:
 * - Internal module with no static import map match.
 * Note: Update related files together when changing data shape or shared behavior.
 */
declare module "pdf-parse" {
  type PdfResult = {
    text?: string;
  };

  function pdfParse(dataBuffer: Buffer): Promise<PdfResult>;
  export default pdfParse;
}
