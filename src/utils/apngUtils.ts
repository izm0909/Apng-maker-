
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
}

function crc32(buf: Uint8Array, start: number, len: number): number {
    let crc = -1;
    for (let i = 0; i < len; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[start + i]) & 0xFF];
    }
    return crc ^ -1;
}

export function setApngLoopCount(buffer: ArrayBuffer, loopCount: number): { buffer: ArrayBuffer, debugInfo: string } {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let debugInfo = "";

    // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
    let offset = 8;
    let foundAcTL = false;

    debugInfo += `Total size: ${bytes.length} bytes\n`;

    while (offset < bytes.length) {
        if (offset + 8 > bytes.length) {
            debugInfo += "Unexpected end of file\n";
            break;
        }

        const length = view.getUint32(offset);
        const type = view.getUint32(offset + 4);

        // Chunk type as string
        const typeStr = String.fromCharCode(
            (type >> 24) & 0xFF,
            (type >> 16) & 0xFF,
            (type >> 8) & 0xFF,
            type & 0xFF
        );
        debugInfo += `Found chunk '${typeStr}' at offset ${offset}. Length: ${length}\n`;

        // "acTL" chunk = 0x6163544C
        if (type === 0x6163544C) {
            foundAcTL = true;
            const oldNumPlays = view.getUint32(offset + 12);
            debugInfo += `Found acTL at offset ${offset}. Old num_plays: ${oldNumPlays}. New: ${loopCount}\n`;

            // acTL data structure:
            // num_frames (4 bytes)
            // num_plays (4 bytes)

            // num_plays is at offset + 8 (header) + 4 (num_frames)
            view.setUint32(offset + 12, loopCount);

            // Recompute CRC
            // CRC is calculated over Chunk Type and Chunk Data
            // Chunk Type starts at offset + 4
            // Data length is 'length'
            // Total bytes to CRC = 4 (type) + length (data)
            const crc = crc32(bytes, offset + 4, length + 4);
            const oldCrc = view.getUint32(offset + 8 + length);

            // Write new CRC at the end of the chunk
            // Chunk ends at offset + 8 + length
            view.setUint32(offset + 8 + length, crc);
            debugInfo += `Updated CRC. Old: ${oldCrc.toString(16)}, New: ${crc.toString(16)}\n`;

            break;
        }

        // Move to next chunk: length + 4 (len) + 4 (type)
        offset += length + 12;
    }

    if (!foundAcTL) {
        debugInfo += "acTL chunk NOT found!\n";
    }

    return { buffer, debugInfo };
}
