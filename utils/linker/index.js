/**
 * @description AMP Linker Parser (works for Rudder, GA or any other linker created by following Google's linker standard.)
 * @version v1.0.0
 * @author Parth Mahajan, Ayush Mehra
 */

import crc32 from "./utils/crc32";
import USER_INTERFACE from "./utils/userLib";
import decode from "./utils/base64decoder";

const KEY_VALIDATOR = /^[a-zA-Z0-9\-_.]+$/;
const CHECKSUM_OFFSET_MAX_MIN = 1;
const VALID_VERSION = 1;
const DELIMITER = "*";

/**
 * Return the key value pairs
 * @param {string} value
 * @return {?Object<string, string>}
 */
function parseLinker(value) {
  const linkerObj = parseLinkerParamValue(value);
  if (!linkerObj) {
    return null;
  }
  const { checksum, serializedIds } = linkerObj;
  if (!isCheckSumValid(serializedIds, checksum)) {
    return null;
  }
  return deserialize(serializedIds);
}

/**
 * Parse the linker param value to version checksum and serializedParams
 * @param {string} value
 * @return {?Object}
 */
function parseLinkerParamValue(value) {
  const parts = value.split(DELIMITER);
  const isEven = parts.length % 2 == 0;

  if (parts.length < 4 || !isEven) {
    // Format <version>*<checksum>*<key1>*<value1>
    // Note: linker makes sure there's at least one pair of non empty key value
    // Make sure there is at least three delimiters.
    return null;
  }

  const version = Number(parts.shift());
  if (version !== VALID_VERSION) {
    return null;
  }

  const checksum = parts.shift();
  const serializedIds = parts.join(DELIMITER);
  return {
    checksum,
    serializedIds,
  };
}

/**
 * Check if the checksum is valid with time offset tolerance.
 * @param {string} serializedIds
 * @param {string} checksum
 * @return {boolean}
 */
function isCheckSumValid(serializedIds, checksum) {
  const userAgent = USER_INTERFACE.getUserAgent();
  const language = USER_INTERFACE.getUserLanguage();
  for (let i = 0; i <= CHECKSUM_OFFSET_MAX_MIN; i++) {
    const calculateCheckSum = getCheckSum(
      serializedIds,
      i,
      userAgent,
      language
    );
    if (calculateCheckSum == checksum) {
      return true;
    }
  }
  return false;
}

/**
 * Deserialize the serializedIds and return keyValue pairs.
 * @param {string} serializedIds
 * @return {!Object<string, string>}
 */
function deserialize(serializedIds) {
  const keyValuePairs = {};
  const params = serializedIds.split(DELIMITER);
  for (let i = 0; i < params.length; i += 2) {
    const key = params[i];
    const valid = KEY_VALIDATOR.test(key);
    if (!valid) {
      continue;
    }
    const value = decode(params[i + 1]);
    //const value = params[i + 1];
    keyValuePairs[key] = value;
  }
  return keyValuePairs;
}

/**
 * Create a unique checksum hashing the fingerprint and a few other values.
 * @param {string} serializedIds
 * @param {number=} opt_offsetMin
 * @return {string}
 */
function getCheckSum(serializedIds, opt_offsetMin, userAgent, language) {
  const fingerprint = getFingerprint(userAgent, language);
  const offset = opt_offsetMin || 0;
  const timestamp = getMinSinceEpoch() - offset;
  const crc = crc32([fingerprint, timestamp, serializedIds].join(DELIMITER));
  // Encoded to base36 for less bytes.
  return crc.toString(36);
}

/**
 * Generates a semi-unique value for page visitor.
 * @return {string}
 */
function getFingerprint(userAgent, language) {
  const date = new Date();
  const timezone = date.getTimezoneOffset();
  return [userAgent, timezone, language].join(DELIMITER);
}

/**
 * Rounded time used to check if t2 - t1 is within our time tolerance.
 * @return {number}
 */
function getMinSinceEpoch() {
  // Timestamp in minutes, floored.
  return Math.floor(Date.now() / 60000);
}

export default parseLinker;
