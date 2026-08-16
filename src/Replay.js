// src/Replay.js

class Replay {
  /**
   * @type {Buffer}
   */
  buffer;

  header = {};

  offset = 0;

  constructor(replay) {
    this.buffer = replay;
  }

  skip(amount) {
    this.offset += amount;
  }

  goTo(offset) {
    this.offset = offset;
  }

  writeInt64(value, offset) {
    if (offset == null) {
      this.offset += 8;
    }

    return this.buffer.writeBigInt64LE(BigInt(value), offset ?? this.offset - 8);
  }

  writeInt32(value, offset) {
    if (offset == null) {
      this.offset += 4;
    }

    return this.buffer.writeInt32LE(value, offset ?? this.offset - 4);
  }

  writeUInt32(value, offset) {
    if (offset == null) {
      this.offset += 4;
    }

    return this.buffer.writeUInt32LE(value, offset ?? this.offset - 4);
  }

  writeInt16(value, offset) {
    if (offset == null) {
      this.offset += 2;
    }

    return this.buffer.writeInt16LE(value, offset ?? this.offset - 2);
  }

  writeUInt16(value, offset) {
    if (offset == null) {
      this.offset += 2;
    }

    return this.buffer.writeUInt16LE(value, offset ?? this.offset - 2);
  }

  writeByte(value, offset) {
    if (offset == null) {
      this.offset += 1;
    }

    this.buffer[offset ?? (this.offset - 1)] = value & 255;
  }

  writeGuid(guid) {
    this.writeBytes(Buffer.from(guid, 'hex'));
  }

  writeString(string, offset) {
    const bytes = Buffer.from(string, 'utf8');

    if (offset == null) {
      this.writeInt32(bytes.length + 1);
      this.writeBytes(bytes);
      this.writeByte(0);
      return;
    }

    this.writeInt32(bytes.length + 1, offset);
    this.writeBytes(bytes, offset + 4);
    this.writeByte(0, offset + 4 + bytes.length);
  }

  writeBytes(bytes, offset) {
    const source = Buffer.isBuffer(bytes)
      ? bytes
      : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const targetOffset = offset ?? this.offset;

    if (targetOffset < 0 || targetOffset + source.length > this.buffer.length) {
      throw new RangeError('Attempted to write beyond the replay buffer');
    }

    source.copy(this.buffer, targetOffset);

    if (offset == null) {
      this.offset += source.length;
    }
  }

  writeArray(array, fn) {
    this.writeInt32(array.length);

    array.forEach((entry) => {
      fn(this, entry);
    });
  }

  writeObject(array, fn1, fn2) {
    this.writeInt32(Object.values(array).length);

    Object.entries(array).forEach(([key, value]) => {
      fn1(this, key);
      fn2(this, value);
    });
  }

  atEnd() {
    return this.offset >= this.buffer.byteLength;
  }
}

module.exports = Replay;
