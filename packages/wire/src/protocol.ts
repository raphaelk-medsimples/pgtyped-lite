import {
  sumSize,
  byte1,
  cString,
  int32,
  int16,
  byteN,
  cByteDict,
} from './helpers';

import {
  TServerMessage,
  TClientMessage,
  messages,
} from './messages';

export const parseSimpleType = (type: any, buf: Buffer, offset: number): {
  result: any,
  offset: number,
} => {
  let result = null;
  if (type instanceof Buffer) {
    const match = type.compare(buf, offset, offset + type.length) === 0;
    offset += type.length;
    if (!match) {
      throw new Error(`Field mismatch inside message`);
    }
  } else if (type === byte1) {
    const val = buf.readInt8(offset);
    result = String.fromCharCode(val);
    offset++;
  } else if (type === cString) {
    const stringStart = offset;
    while (buf.readInt8(offset) !== 0) {
      offset++;
    }
    result = buf.toString('utf8', stringStart, offset);
    offset++;
  } else if (type === byteN) {
    const chunkSize = buf.readInt32BE(offset);
    offset += 4;
    result = buf.slice(offset, offset + chunkSize);
    offset += result.length;
  } else if (type === int32) {
    result = buf.readInt32BE(offset);
    offset += 4;
  } else if (type === int16) {
    result = buf.readInt16BE(offset);
    offset += 2;
  }
  return { result, offset }
}

export interface MessagePayload<Params> {
  type: 'MessagePayload',
  data: Params,
  messageName: string,
  bufferOffset: number,
};

interface MessageMismatchError {
  type: 'MessageMismatchError',
  messageName: string,
  bufferOffset: number,
};

interface ServerError {
  type: 'ServerError',
  severity: 'ERROR' | 'FATAL' | 'PANIC' | 'WARNING' | 'NOTICE' | 'DEBUG' | 'INFO' | 'LOG',
  message: string,
  bufferOffset: number,
};

export type ParseResult<Params> = MessagePayload<Params> | MessageMismatchError | ServerError;

const errorResponseMessageIndicator = messages.errorResponse.indicator.charCodeAt(0);

export const parseMessage = <Params extends Object>(
  message: TServerMessage<Params>,
  buf: Buffer,
  messageOffset: number = 0,
): ParseResult<Params> => {
  let bufferOffset = messageOffset;
  const indicator = buf.readInt8(bufferOffset);
  const expectedIndicator = message.indicator.charCodeAt(0);
  const isErrorMessage = (
    indicator === errorResponseMessageIndicator
    && expectedIndicator !== errorResponseMessageIndicator
  );

  bufferOffset++;

  let messageSize = buf.readUInt32BE(bufferOffset);

  // Add extra one because message id isnt counted into size
  const messageEnd = messageSize + messageOffset + 1;

  if (indicator !== expectedIndicator && !isErrorMessage) {
    return {
      type: 'MessageMismatchError',
      messageName: message.name,
      bufferOffset: messageEnd,
    };
  }

  bufferOffset += 4;

  const pattern = isErrorMessage
    ? messages.errorResponse.pattern
    : message.pattern;

  let result: { [key: string]: any } = {};
  const patternPairs = Object.entries(pattern);
  let pairIndex = 0;
  while (bufferOffset !== messageEnd) {
    const [key, type] = patternPairs[pairIndex];
    if (type === cByteDict) {
      const dict: { [key: string]: string } = {};
      let fieldKey;
      while (({
        result: fieldKey,
        offset: bufferOffset,
      } = parseSimpleType(byte1, buf, bufferOffset)).result !== '\u0000') {
        const {
          result: fieldValue,
          offset: valueOffset,
        } = parseSimpleType(cString, buf, bufferOffset);
        bufferOffset = valueOffset;
        dict[fieldKey] = fieldValue;
      }
      result[key] = dict;
    } else if (type instanceof Array) {
      const arraySize = buf.readInt16BE(bufferOffset)
      bufferOffset += 2;
      const array = [];
      for (let i = 0; i < arraySize; i++) {
        const subPattern = Object.entries(type[0] as Object);
        let subResult: { [key: string]: any } = {};
        for (const [subKey, subType] of subPattern) {
          const {
            result: fieldResult,
            offset: fieldOffset,
          } = parseSimpleType(subType, buf, bufferOffset);
          subResult[subKey] = fieldResult;
          bufferOffset = fieldOffset;
        }
        array.push(subResult);
      }
      result[key] = array;
    } else {
      const {
        result: fieldResult,
        offset: fieldOffset,
      } = parseSimpleType(type, buf, bufferOffset);
      result[key] = fieldResult;
      bufferOffset = fieldOffset;
    }
    pairIndex++;
  }

  if (isErrorMessage) {
    return {
      type: 'ServerError',
      bufferOffset,
      severity: result.fields['S'],
      message: result.fields['M'],
    };
  }
  return {
    type: 'MessagePayload',
    data: result as Params,
    bufferOffset,
    messageName: message.name,
  };
};

export const buildMessage = <Params extends Object>(
  message: TClientMessage<Params>,
  parameters: Params,
): Buffer => {
  const bufArray = message.pattern(parameters);
  const bufferSize =
    + (message.indicator ? 1 : 0) // indicator byte if present
    + 4 // message size 
    + sumSize(bufArray); // payload
  const buf = Buffer.alloc(bufferSize);
  let offset = 0;
  if (message.indicator) {
    buf[0] = message.indicator.charCodeAt(0);
    offset++;
  }

  const messageSize = bufferSize - (message.indicator ? 1 : 0);
  buf.writeUInt32BE(messageSize, offset);
  offset += 4;

  bufArray.forEach(sbuf => {
    sbuf.copy(buf, offset);
    offset = offset + sbuf.length;
  })
  return buf;
};

export const parseOneOf = (
  messages: Array<TServerMessage<any>>,
  buffer: Buffer,
  offset: number,
): ParseResult<Object> => {
  let failed = true;
  const messageName = messages.map(m => m.name).join(' | ');
  let lastBufferOffset = 0;
  for (const message of messages) {
    let parseResult = parseMessage(message, buffer, offset);
    if (parseResult.type !== 'MessageMismatchError') {
      return parseResult;
    }
    lastBufferOffset = parseResult.bufferOffset;
  }
  return {
    type: 'MessageMismatchError',
    messageName,
    bufferOffset: lastBufferOffset,
  };
};
