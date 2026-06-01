// Pure Node.js document text extraction — no external packages needed

export async function extractTextFromBuffer(buffer: Buffer, ext: string, fileName: string): Promise<string> {
  try {
    if (ext === '.txt' || ext === '.md') {
      return buffer.toString('utf-8')
    }

    if (ext === '.docx') {
      return await extractDocx(buffer)
    }

    if (ext === '.doc') {
      // Old .doc format is binary — return empty so user can type content manually
      return ''
    }

    if (ext === '.pdf') {
      return await extractPdf(buffer)
    }

    return ''
  } catch (err: any) {
    console.error(`Text extraction failed for ${fileName}:`, err.message)
    return ''
  }
}

// Extract text from .docx (which is a ZIP containing XML files)
async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    // .docx files are ZIP archives — use Node's built-in zlib to unzip
    const { Readable } = await import('stream')
    
    // Find the word/document.xml inside the ZIP
    // ZIP format: look for local file headers (PK\x03\x04)
    const content = buffer.toString('binary')
    const texts: string[] = []
    
    let offset = 0
    while (offset < buffer.length - 4) {
      // Local file header signature
      if (buffer[offset] === 0x50 && buffer[offset+1] === 0x4B && 
          buffer[offset+2] === 0x03 && buffer[offset+3] === 0x04) {
        
        const compressionMethod = buffer.readUInt16LE(offset + 8)
        const compressedSize = buffer.readUInt32LE(offset + 18)
        const filenameLength = buffer.readUInt16LE(offset + 26)
        const extraLength = buffer.readUInt16LE(offset + 28)
        const filename = buffer.slice(offset + 30, offset + 30 + filenameLength).toString('utf-8')
        const dataOffset = offset + 30 + filenameLength + extraLength
        const fileData = buffer.slice(dataOffset, dataOffset + compressedSize)
        
        if (filename === 'word/document.xml') {
          let xmlContent = ''
          if (compressionMethod === 0) {
            // Stored (not compressed)
            xmlContent = fileData.toString('utf-8')
          } else if (compressionMethod === 8) {
            // Deflate compressed
            const zlib = await import('zlib')
            const decompressed = await new Promise<Buffer>((resolve, reject) => {
              zlib.inflateRaw(fileData, (err, result) => {
                if (err) reject(err)
                else resolve(result)
              })
            })
            xmlContent = decompressed.toString('utf-8')
          }
          
          if (xmlContent) {
            // Extract text from XML — get content between <w:t> tags
            const matches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
            const text = matches
              .map(m => m.replace(/<[^>]+>/g, ''))
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()
            if (text.length > 0) texts.push(text)
          }
        }
        
        offset = dataOffset + compressedSize
      } else {
        offset++
      }
    }
    
    return texts.join('\n\n').trim()
  } catch (err: any) {
    console.error('DOCX extraction error:', err.message)
    return ''
  }
}

// Basic PDF text extraction — works for text-based PDFs
async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    const content = buffer.toString('latin1')
    const texts: string[] = []
    
    // Extract text from PDF stream objects
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
    let match
    
    while ((match = streamRegex.exec(content)) !== null) {
      const streamContent = match[1]
      
      // Look for text-showing operators: Tj, TJ, '
      const tjMatches = streamContent.match(/\(((?:[^()\\]|\\[\s\S])*)\)\s*Tj/g) || []
      const tjArrayMatches = streamContent.match(/\[((?:[^\[\]]*|\[[^\]]*\])*)\]\s*TJ/g) || []
      
      for (const m of tjMatches) {
        const text = m.replace(/\(|\)\s*Tj/g, '').replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\/g, '')
        if (text.trim()) texts.push(text.trim())
      }
      
      for (const m of tjArrayMatches) {
        const parts = m.match(/\(([^)]*)\)/g) || []
        const text = parts.map(p => p.slice(1, -1)).join('').replace(/\\/g, '')
        if (text.trim()) texts.push(text.trim())
      }
    }
    
    return texts.join(' ').replace(/\s+/g, ' ').trim()
  } catch (err: any) {
    console.error('PDF extraction error:', err.message)
    return ''
  }
}
