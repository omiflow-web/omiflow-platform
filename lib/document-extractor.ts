// Server-side only document text extraction

export async function extractTextFromBuffer(buffer: Buffer, ext: string, fileName: string): Promise<string> {
  try {
    if (ext === '.txt' || ext === '.md') {
      return buffer.toString('utf-8')
    }

    if (ext === '.docx' || ext === '.doc') {
      // Dynamic import to avoid bundler issues
      const mammoth = (await import('mammoth')).default
      const result = await mammoth.extractRawText({ buffer })
      const text = result.value?.trim() || ''
      if (text.length > 0) return text
      return `[Could not extract text from ${fileName} — try converting to plain text or PDF]`
    }

    if (ext === '.pdf') {
      // Dynamic import to avoid bundler issues
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buffer)
      const text = data.text?.trim() || ''
      if (text.length > 0) return text
      return `[Could not extract text from ${fileName} — this may be a scanned PDF. Try a text-based PDF or plain text file]`
    }

    return `[Unsupported file type: ${ext}]`
  } catch (err: any) {
    console.error(`Text extraction failed for ${fileName}:`, err.message)
    // Return empty string so the user can manually type the content in the edit modal
    return ''
  }
}
