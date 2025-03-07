// src/config.ts
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// src/actions.ts
import { names, uniqueNamesGenerator } from "unique-names-generator";
var composeActionExamples = (actionsData, count) => {
  const data = actionsData.map((action) => [
    ...action.examples
  ]);
  const actionExamples = [];
  let length = data.length;
  for (let i = 0; i < count && length; i++) {
    const actionId = i % length;
    const examples = data[actionId];
    if (examples.length) {
      const rand = ~~(Math.random() * examples.length);
      actionExamples[i] = examples.splice(rand, 1)[0];
    } else {
      i--;
    }
    if (examples.length == 0) {
      data.splice(actionId, 1);
      length--;
    }
  }
  const formattedExamples = actionExamples.map((example) => {
    const exampleNames = Array.from(
      { length: 5 },
      () => uniqueNamesGenerator({ dictionaries: [names] })
    );
    return `
${example.map((message) => {
      let messageString = `${message.user}: ${message.content.text}${message.content.action ? ` (${message.content.action})` : ""}`;
      for (let i = 0; i < exampleNames.length; i++) {
        messageString = messageString.replaceAll(
          `{{user${i + 1}}}`,
          exampleNames[i]
        );
      }
      return messageString;
    }).join("\n")}`;
  });
  return formattedExamples.join("\n");
};
function formatActionNames(actions) {
  return actions.sort(() => 0.5 - Math.random()).map((action) => `${action.name}`).join(", ");
}
function formatActions(actions) {
  return actions.sort(() => 0.5 - Math.random()).map((action) => `${action.name}: ${action.description}`).join(",\n");
}

// src/context.ts
import handlebars from "handlebars";
import { names as names2, uniqueNamesGenerator as uniqueNamesGenerator2 } from "unique-names-generator";
var composeContext = ({
  state,
  template,
  templatingEngine
}) => {
  const templateStr = typeof template === "function" ? template({ state }) : template;
  if (templatingEngine === "handlebars") {
    const templateFunction = handlebars.compile(templateStr);
    return templateFunction(state);
  }
  const out = templateStr.replace(/{{\w+}}/g, (match) => {
    const key = match.replace(/{{|}}/g, "");
    return state[key] ?? "";
  });
  return out;
};
var addHeader = (header, body) => {
  return body.length > 0 ? `${header ? header + "\n" : header}${body}
` : "";
};
var composeRandomUser = (template, length) => {
  const exampleNames = Array.from(
    { length },
    () => uniqueNamesGenerator2({ dictionaries: [names2] })
  );
  let result = template;
  for (let i = 0; i < exampleNames.length; i++) {
    result = result.replaceAll(`{{user${i + 1}}}`, exampleNames[i]);
  }
  return result;
};

// src/database/CircuitBreaker.ts
var CircuitBreaker = class {
  constructor(config2 = {}) {
    this.config = config2;
    this.failureThreshold = config2.failureThreshold ?? 5;
    this.resetTimeout = config2.resetTimeout ?? 6e4;
    this.halfOpenMaxAttempts = config2.halfOpenMaxAttempts ?? 3;
  }
  state = "CLOSED";
  failureCount = 0;
  lastFailureTime;
  halfOpenSuccesses = 0;
  failureThreshold;
  resetTimeout;
  halfOpenMaxAttempts;
  async execute(operation) {
    if (this.state === "OPEN") {
      if (Date.now() - (this.lastFailureTime || 0) > this.resetTimeout) {
        this.state = "HALF_OPEN";
        this.halfOpenSuccesses = 0;
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }
    try {
      const result = await operation();
      if (this.state === "HALF_OPEN") {
        this.halfOpenSuccesses++;
        if (this.halfOpenSuccesses >= this.halfOpenMaxAttempts) {
          this.reset();
        }
      }
      return result;
    } catch (error) {
      this.handleFailure();
      throw error;
    }
  }
  handleFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state !== "OPEN" && this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }
  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = void 0;
  }
  getState() {
    return this.state;
  }
};

// src/logger.ts
import pino from "pino";
import pretty from "pino-pretty";

// src/parsing.ts
var jsonBlockPattern = /```json\n([\s\S]*?)\n```/;
var messageCompletionFooter = `
Response format should be formatted in a valid JSON block like this:
\`\`\`json
{ "user": "{{agentName}}", "text": "<string>", "action": "<string>" }
\`\`\`

The \u201Caction\u201D field should be one of the options in [Available Actions] and the "text" field should be the response you want to send.
`;
var shouldRespondFooter = `The available options are [RESPOND], [IGNORE], or [STOP]. Choose the most appropriate option.
If {{agentName}} is talking too much, you can choose [IGNORE]

Your response must include one of the options.`;
var parseShouldRespondFromText = (text) => {
  const match = text.split("\n")[0].trim().replace("[", "").toUpperCase().replace("]", "").match(/^(RESPOND|IGNORE|STOP)$/i);
  return match ? match[0].toUpperCase() : text.includes("RESPOND") ? "RESPOND" : text.includes("IGNORE") ? "IGNORE" : text.includes("STOP") ? "STOP" : null;
};
var booleanFooter = `Respond with only a YES or a NO.`;
var parseBooleanFromText = (text) => {
  if (!text) return null;
  const affirmative = ["YES", "Y", "TRUE", "T", "1", "ON", "ENABLE"];
  const negative = ["NO", "N", "FALSE", "F", "0", "OFF", "DISABLE"];
  const normalizedText = text.trim().toUpperCase();
  if (affirmative.includes(normalizedText)) {
    return true;
  } else if (negative.includes(normalizedText)) {
    return false;
  }
  return null;
};
var stringArrayFooter = `Respond with a JSON array containing the values in a valid JSON block formatted for markdown with this structure:
\`\`\`json
[
  'value',
  'value'
]
\`\`\`

Your response must include the valid JSON block.`;
function parseJsonArrayFromText(text) {
  let jsonData = null;
  const jsonBlockMatch = text.match(jsonBlockPattern);
  if (jsonBlockMatch) {
    try {
      const normalizedJson = jsonBlockMatch[1].replace(
        /(?<!\\)'([^']*)'(?=\s*[,}\]])/g,
        '"$1"'
      );
      jsonData = JSON.parse(normalizedJson);
    } catch (e) {
      console.error("Error parsing JSON:", e);
      console.error("Failed parsing text:", jsonBlockMatch[1]);
    }
  }
  if (!jsonData) {
    const arrayPattern = /\[\s*(['"])(.*?)\1\s*\]/;
    const arrayMatch = text.match(arrayPattern);
    if (arrayMatch) {
      try {
        const normalizedJson = arrayMatch[0].replace(
          /(?<!\\)'([^']*)'(?=\s*[,}\]])/g,
          '"$1"'
        );
        jsonData = JSON.parse(normalizedJson);
      } catch (e) {
        console.error("Error parsing JSON:", e);
        console.error("Failed parsing text:", arrayMatch[0]);
      }
    }
  }
  if (Array.isArray(jsonData)) {
    return jsonData;
  }
  return null;
}
function parseJSONObjectFromText(text) {
  let jsonData = null;
  const jsonBlockMatch = text.match(jsonBlockPattern);
  if (jsonBlockMatch) {
    text = cleanJsonResponse(text);
    const parsingText = normalizeJsonString(text);
    try {
      jsonData = JSON.parse(parsingText);
    } catch (e) {
      console.error("Error parsing JSON:", e);
      console.error("Text is not JSON", text);
      return extractAttributes(text);
    }
  } else {
    const objectPattern = /{[\s\S]*?}?/;
    const objectMatch = text.match(objectPattern);
    if (objectMatch) {
      text = cleanJsonResponse(text);
      const parsingText = normalizeJsonString(text);
      try {
        jsonData = JSON.parse(parsingText);
      } catch (e) {
        console.error("Error parsing JSON:", e);
        console.error("Text is not JSON", text);
        return extractAttributes(text);
      }
    }
  }
  if (typeof jsonData === "object" && jsonData !== null && !Array.isArray(jsonData)) {
    return jsonData;
  } else if (typeof jsonData === "object" && Array.isArray(jsonData)) {
    return parseJsonArrayFromText(text);
  } else {
    return null;
  }
}
function extractAttributes(response, attributesToExtract) {
  response = response.trim();
  const attributes = {};
  if (!attributesToExtract || attributesToExtract.length === 0) {
    const matches = response.matchAll(/"([^"]+)"\s*:\s*"([^"]*)"?/g);
    for (const match of matches) {
      attributes[match[1]] = match[2];
    }
  } else {
    attributesToExtract.forEach((attribute) => {
      const match = response.match(
        new RegExp(`"${attribute}"\\s*:\\s*"([^"]*)"?`, "i")
      );
      if (match) {
        attributes[attribute] = match[1];
      }
    });
  }
  return Object.entries(attributes).length > 0 ? attributes : null;
}
var normalizeJsonString = (str) => {
  str = str.replace(/\{\s+/, "{").replace(/\s+\}/, "}").trim();
  str = str.replace(
    /("[\w\d_-]+")\s*: \s*(?!"|\[)([\s\S]+?)(?=(,\s*"|\}$))/g,
    '$1: "$2"'
  );
  str = str.replace(
    /"([^"]+)"\s*:\s*'([^']*)'/g,
    (_, key, value) => `"${key}": "${value}"`
  );
  str = str.replace(/("[\w\d_-]+")\s*:\s*([A-Za-z_]+)(?!["\w])/g, '$1: "$2"');
  str = str.replace(/(?:"')|(?:'")/g, '"');
  return str;
};
function cleanJsonResponse(response) {
  return response.replace(/```json\s*/g, "").replace(/```\s*/g, "").replace(/(\r\n|\n|\r)/g, "").trim();
}
var postActionResponseFooter = `Choose any combination of [LIKE], [RETWEET], [QUOTE], and [REPLY] that are appropriate. Each action must be on its own line. Your response must only include the chosen actions.`;
var parseActionResponseFromText = (text) => {
  const actions = {
    like: false,
    retweet: false,
    quote: false,
    reply: false
  };
  const likePattern = /\[LIKE\]/i;
  const retweetPattern = /\[RETWEET\]/i;
  const quotePattern = /\[QUOTE\]/i;
  const replyPattern = /\[REPLY\]/i;
  actions.like = likePattern.test(text);
  actions.retweet = retweetPattern.test(text);
  actions.quote = quotePattern.test(text);
  actions.reply = replyPattern.test(text);
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "[LIKE]") actions.like = true;
    if (trimmed === "[RETWEET]") actions.retweet = true;
    if (trimmed === "[QUOTE]") actions.quote = true;
    if (trimmed === "[REPLY]") actions.reply = true;
  }
  return { actions };
};
function truncateToCompleteSentence(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  const lastPeriodIndex = text.lastIndexOf(".", maxLength - 1);
  if (lastPeriodIndex !== -1) {
    const truncatedAtPeriod = text.slice(0, lastPeriodIndex + 1).trim();
    if (truncatedAtPeriod.length > 0) {
      return truncatedAtPeriod;
    }
  }
  const lastSpaceIndex = text.lastIndexOf(" ", maxLength - 1);
  if (lastSpaceIndex !== -1) {
    const truncatedAtSpace = text.slice(0, lastSpaceIndex).trim();
    if (truncatedAtSpace.length > 0) {
      return truncatedAtSpace + "...";
    }
  }
  const hardTruncated = text.slice(0, maxLength - 3).trim();
  return hardTruncated + "...";
}

// src/logger.ts
var customLevels = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  log: 29,
  progress: 28,
  success: 27,
  debug: 20,
  trace: 10
};
var raw = parseBooleanFromText(process?.env?.LOG_JSON_FORMAT) || false;
var createStream = () => {
  if (raw) {
    return void 0;
  }
  return pretty({
    colorize: true,
    translateTime: "yyyy-mm-dd HH:MM:ss",
    ignore: "pid,hostname"
  });
};
var defaultLevel = process?.env?.DEFAULT_LOG_LEVEL || "info";
var options = {
  level: defaultLevel,
  customLevels,
  hooks: {
    logMethod(inputArgs, method) {
      const [arg1, ...rest] = inputArgs;
      if (typeof arg1 === "object") {
        const messageParts = rest.map(
          (arg) => typeof arg === "string" ? arg : JSON.stringify(arg)
        );
        const message = messageParts.join(" ");
        method.apply(this, [arg1, message]);
      } else {
        const context = {};
        const messageParts = [arg1, ...rest].map(
          (arg) => typeof arg === "string" ? arg : arg
        );
        const message = messageParts.filter((part) => typeof part === "string").join(" ");
        const jsonParts = messageParts.filter(
          (part) => typeof part === "object"
        );
        Object.assign(context, ...jsonParts);
        method.apply(this, [context, message]);
      }
    }
  }
};
var elizaLogger = pino(options, createStream());
var logger_default = elizaLogger;

// src/database.ts
var DatabaseAdapter = class {
  /**
   * The database instance.
   */
  db;
  /**
   * Circuit breaker instance used to handle fault tolerance and prevent cascading failures.
   * Implements the Circuit Breaker pattern to temporarily disable operations when a failure threshold is reached.
   *
   * The circuit breaker has three states:
   * - CLOSED: Normal operation, requests pass through
   * - OPEN: Failure threshold exceeded, requests are blocked
   * - HALF_OPEN: Testing if service has recovered
   *
   * @protected
   */
  circuitBreaker;
  /**
   * Creates a new DatabaseAdapter instance with optional circuit breaker configuration.
   *
   * @param circuitBreakerConfig - Configuration options for the circuit breaker
   * @param circuitBreakerConfig.failureThreshold - Number of failures before circuit opens (defaults to 5)
   * @param circuitBreakerConfig.resetTimeout - Time in ms before attempting to close circuit (defaults to 60000)
   * @param circuitBreakerConfig.halfOpenMaxAttempts - Number of successful attempts needed to close circuit (defaults to 3)
   */
  constructor(circuitBreakerConfig) {
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig);
  }
  /**
   * Executes an operation with circuit breaker protection.
   * @param operation A function that returns a Promise to be executed with circuit breaker protection
   * @param context A string describing the context/operation being performed for logging purposes
   * @returns A Promise that resolves to the result of the operation
   * @throws Will throw an error if the circuit breaker is open or if the operation fails
   * @protected
   */
  async withCircuitBreaker(operation, context) {
    try {
      return await this.circuitBreaker.execute(operation);
    } catch (error) {
      elizaLogger.error(`Circuit breaker error in ${context}:`, {
        error: error instanceof Error ? error.message : String(error),
        state: this.circuitBreaker.getState()
      });
      throw error;
    }
  }
};

// src/settings.ts
import { config } from "dotenv";
import fs from "fs";
import path2 from "path";
logger_default.info("Loading embedding settings:", {
  USE_OPENAI_EMBEDDING: process.env.USE_OPENAI_EMBEDDING,
  USE_OLLAMA_EMBEDDING: process.env.USE_OLLAMA_EMBEDDING,
  OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large"
});
logger_default.debug("Loading character settings:", {
  CHARACTER_PATH: process.env.CHARACTER_PATH,
  ARGV: process.argv,
  CHARACTER_ARG: process.argv.find((arg) => arg.startsWith("--character=")),
  CWD: process.cwd()
});
var environmentSettings = {};
var isBrowser = () => {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
};
function findNearestEnvFile(startDir = process.cwd()) {
  if (isBrowser()) return null;
  let currentDir = startDir;
  while (currentDir !== path2.parse(currentDir).root) {
    const envPath = path2.join(currentDir, ".env");
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    currentDir = path2.dirname(currentDir);
  }
  const rootEnvPath = path2.join(path2.parse(currentDir).root, ".env");
  return fs.existsSync(rootEnvPath) ? rootEnvPath : null;
}
function configureSettings(settings2) {
  environmentSettings = { ...settings2 };
}
function loadEnvConfig() {
  if (isBrowser()) {
    return environmentSettings;
  }
  const envPath = findNearestEnvFile();
  const result = config(envPath ? { path: envPath } : {});
  if (!result.error) {
    logger_default.log(`Loaded .env file from: ${envPath}`);
  }
  const namespacedSettings = parseNamespacedSettings(process.env);
  Object.entries(namespacedSettings).forEach(([namespace, settings2]) => {
    process.env[`__namespaced_${namespace}`] = JSON.stringify(settings2);
  });
  return process.env;
}
function getEnvVariable(key, defaultValue) {
  if (isBrowser()) {
    return environmentSettings[key] || defaultValue;
  }
  return process.env[key] || defaultValue;
}
function hasEnvVariable(key) {
  if (isBrowser()) {
    return key in environmentSettings;
  }
  return key in process.env;
}
var settings = isBrowser() ? environmentSettings : loadEnvConfig();
logger_default.info("Parsed settings:", {
  USE_OPENAI_EMBEDDING: settings.USE_OPENAI_EMBEDDING,
  USE_OPENAI_EMBEDDING_TYPE: typeof settings.USE_OPENAI_EMBEDDING,
  USE_OLLAMA_EMBEDDING: settings.USE_OLLAMA_EMBEDDING,
  USE_OLLAMA_EMBEDDING_TYPE: typeof settings.USE_OLLAMA_EMBEDDING,
  OLLAMA_EMBEDDING_MODEL: settings.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large"
});
var settings_default = settings;
function parseNamespacedSettings(env) {
  const namespaced = {};
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    const [namespace, ...rest] = key.split(".");
    if (!namespace || rest.length === 0) continue;
    const settingKey = rest.join(".");
    namespaced[namespace] = namespaced[namespace] || {};
    namespaced[namespace][settingKey] = value;
  }
  return namespaced;
}

// src/types.ts
var GoalStatus = /* @__PURE__ */ ((GoalStatus2) => {
  GoalStatus2["DONE"] = "DONE";
  GoalStatus2["FAILED"] = "FAILED";
  GoalStatus2["IN_PROGRESS"] = "IN_PROGRESS";
  return GoalStatus2;
})(GoalStatus || {});
var ModelClass = /* @__PURE__ */ ((ModelClass2) => {
  ModelClass2["SMALL"] = "small";
  ModelClass2["MEDIUM"] = "medium";
  ModelClass2["LARGE"] = "large";
  ModelClass2["EMBEDDING"] = "embedding";
  ModelClass2["IMAGE"] = "image";
  return ModelClass2;
})(ModelClass || {});
var ModelProviderName = /* @__PURE__ */ ((ModelProviderName2) => {
  ModelProviderName2["OPENAI"] = "openai";
  ModelProviderName2["ETERNALAI"] = "eternalai";
  ModelProviderName2["ANTHROPIC"] = "anthropic";
  ModelProviderName2["GROK"] = "grok";
  ModelProviderName2["GROQ"] = "groq";
  ModelProviderName2["LLAMACLOUD"] = "llama_cloud";
  ModelProviderName2["TOGETHER"] = "together";
  ModelProviderName2["LLAMALOCAL"] = "llama_local";
  ModelProviderName2["LMSTUDIO"] = "lmstudio";
  ModelProviderName2["GOOGLE"] = "google";
  ModelProviderName2["MISTRAL"] = "mistral";
  ModelProviderName2["CLAUDE_VERTEX"] = "claude_vertex";
  ModelProviderName2["REDPILL"] = "redpill";
  ModelProviderName2["OPENROUTER"] = "openrouter";
  ModelProviderName2["OLLAMA"] = "ollama";
  ModelProviderName2["HEURIST"] = "heurist";
  ModelProviderName2["GALADRIEL"] = "galadriel";
  ModelProviderName2["FAL"] = "falai";
  ModelProviderName2["GAIANET"] = "gaianet";
  ModelProviderName2["ALI_BAILIAN"] = "ali_bailian";
  ModelProviderName2["VOLENGINE"] = "volengine";
  ModelProviderName2["NANOGPT"] = "nanogpt";
  ModelProviderName2["HYPERBOLIC"] = "hyperbolic";
  ModelProviderName2["VENICE"] = "venice";
  ModelProviderName2["NVIDIA"] = "nvidia";
  ModelProviderName2["NINETEEN_AI"] = "nineteen_ai";
  ModelProviderName2["AKASH_CHAT_API"] = "akash_chat_api";
  ModelProviderName2["LIVEPEER"] = "livepeer";
  ModelProviderName2["LETZAI"] = "letzai";
  ModelProviderName2["DEEPSEEK"] = "deepseek";
  ModelProviderName2["INFERA"] = "infera";
  ModelProviderName2["BEDROCK"] = "bedrock";
  ModelProviderName2["ATOMA"] = "atoma";
  ModelProviderName2["SECRETAI"] = "secret_ai";
  ModelProviderName2["NEARAI"] = "nearai";
  return ModelProviderName2;
})(ModelProviderName || {});
var CacheStore = /* @__PURE__ */ ((CacheStore2) => {
  CacheStore2["REDIS"] = "redis";
  CacheStore2["DATABASE"] = "database";
  CacheStore2["FILESYSTEM"] = "filesystem";
  return CacheStore2;
})(CacheStore || {});
var Service = class _Service {
  static instance = null;
  static get serviceType() {
    throw new Error("Service must implement static serviceType getter");
  }
  static getInstance() {
    if (!_Service.instance) {
      _Service.instance = new this();
    }
    return _Service.instance;
  }
  get serviceType() {
    return this.constructor.serviceType;
  }
};
var IrysMessageType = /* @__PURE__ */ ((IrysMessageType2) => {
  IrysMessageType2["REQUEST"] = "REQUEST";
  IrysMessageType2["DATA_STORAGE"] = "DATA_STORAGE";
  IrysMessageType2["REQUEST_RESPONSE"] = "REQUEST_RESPONSE";
  return IrysMessageType2;
})(IrysMessageType || {});
var IrysDataType = /* @__PURE__ */ ((IrysDataType2) => {
  IrysDataType2["FILE"] = "FILE";
  IrysDataType2["IMAGE"] = "IMAGE";
  IrysDataType2["OTHER"] = "OTHER";
  return IrysDataType2;
})(IrysDataType || {});
var ServiceType = /* @__PURE__ */ ((ServiceType2) => {
  ServiceType2["IMAGE_DESCRIPTION"] = "image_description";
  ServiceType2["TRANSCRIPTION"] = "transcription";
  ServiceType2["VIDEO"] = "video";
  ServiceType2["TEXT_GENERATION"] = "text_generation";
  ServiceType2["BROWSER"] = "browser";
  ServiceType2["SPEECH_GENERATION"] = "speech_generation";
  ServiceType2["PDF"] = "pdf";
  ServiceType2["INTIFACE"] = "intiface";
  ServiceType2["AWS_S3"] = "aws_s3";
  ServiceType2["BUTTPLUG"] = "buttplug";
  ServiceType2["SLACK"] = "slack";
  ServiceType2["VERIFIABLE_LOGGING"] = "verifiable_logging";
  ServiceType2["IRYS"] = "irys";
  ServiceType2["TEE_LOG"] = "tee_log";
  ServiceType2["GOPLUS_SECURITY"] = "goplus_security";
  ServiceType2["WEB_SEARCH"] = "web_search";
  ServiceType2["EMAIL_AUTOMATION"] = "email_automation";
  ServiceType2["NKN_CLIENT_SERVICE"] = "nkn_client_service";
  return ServiceType2;
})(ServiceType || {});
var LoggingLevel = /* @__PURE__ */ ((LoggingLevel2) => {
  LoggingLevel2["DEBUG"] = "debug";
  LoggingLevel2["VERBOSE"] = "verbose";
  LoggingLevel2["NONE"] = "none";
  return LoggingLevel2;
})(LoggingLevel || {});
var TokenizerType = /* @__PURE__ */ ((TokenizerType2) => {
  TokenizerType2["Auto"] = "auto";
  TokenizerType2["TikToken"] = "tiktoken";
  return TokenizerType2;
})(TokenizerType || {});
var TranscriptionProvider = /* @__PURE__ */ ((TranscriptionProvider2) => {
  TranscriptionProvider2["OpenAI"] = "openai";
  TranscriptionProvider2["Deepgram"] = "deepgram";
  TranscriptionProvider2["Local"] = "local";
  return TranscriptionProvider2;
})(TranscriptionProvider || {});
var ActionTimelineType = /* @__PURE__ */ ((ActionTimelineType2) => {
  ActionTimelineType2["ForYou"] = "foryou";
  ActionTimelineType2["Following"] = "following";
  return ActionTimelineType2;
})(ActionTimelineType || {});
var KnowledgeScope = /* @__PURE__ */ ((KnowledgeScope2) => {
  KnowledgeScope2["SHARED"] = "shared";
  KnowledgeScope2["PRIVATE"] = "private";
  return KnowledgeScope2;
})(KnowledgeScope || {});
var CacheKeyPrefix = /* @__PURE__ */ ((CacheKeyPrefix2) => {
  CacheKeyPrefix2["KNOWLEDGE"] = "knowledge";
  return CacheKeyPrefix2;
})(CacheKeyPrefix || {});

// src/models.ts
var models = {
  ["openai" /* OPENAI */]: {
    endpoint: settings_default.OPENAI_API_URL || "https://api.openai.com/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_OPENAI_MODEL || "gpt-4o-mini",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_OPENAI_MODEL || "gpt-4o",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_OPENAI_MODEL || "gpt-4o",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["embedding" /* EMBEDDING */]: {
        name: settings_default.EMBEDDING_OPENAI_MODEL || "text-embedding-3-small",
        dimensions: 1536
      },
      ["image" /* IMAGE */]: {
        name: settings_default.IMAGE_OPENAI_MODEL || "dall-e-3"
      }
    }
  },
  ["eternalai" /* ETERNALAI */]: {
    endpoint: settings_default.ETERNALAI_URL,
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.ETERNALAI_MODEL || "neuralmagic/Meta-Llama-3.1-405B-Instruct-quantized.w4a16",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.ETERNALAI_MODEL || "neuralmagic/Meta-Llama-3.1-405B-Instruct-quantized.w4a16",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.ETERNALAI_MODEL || "neuralmagic/Meta-Llama-3.1-405B-Instruct-quantized.w4a16",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      }
    }
  },
  ["anthropic" /* ANTHROPIC */]: {
    endpoint: settings_default.ANTHROPIC_API_URL || "https://api.anthropic.com/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_ANTHROPIC_MODEL || "claude-3-haiku-20240307",
        stop: [],
        maxInputTokens: 2e5,
        maxOutputTokens: 4096,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
        stop: [],
        maxInputTokens: 2e5,
        maxOutputTokens: 4096,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
        stop: [],
        maxInputTokens: 2e5,
        maxOutputTokens: 4096,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      }
    }
  },
  ["claude_vertex" /* CLAUDE_VERTEX */]: {
    endpoint: settings_default.ANTHROPIC_API_URL || "https://api.anthropic.com/v1",
    // TODO: check
    model: {
      ["small" /* SMALL */]: {
        name: "claude-3-5-sonnet-20241022",
        stop: [],
        maxInputTokens: 2e5,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: "claude-3-5-sonnet-20241022",
        stop: [],
        maxInputTokens: 2e5,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: "claude-3-opus-20240229",
        stop: [],
        maxInputTokens: 2e5,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      }
    }
  },
  ["grok" /* GROK */]: {
    endpoint: "https://api.x.ai/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_GROK_MODEL || "grok-2-1212",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_GROK_MODEL || "grok-2-1212",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_GROK_MODEL || "grok-2-1212",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["embedding" /* EMBEDDING */]: {
        name: settings_default.EMBEDDING_GROK_MODEL || "grok-2-1212"
        // not sure about this one
      }
    }
  },
  ["groq" /* GROQ */]: {
    endpoint: "https://api.groq.com/openai/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_GROQ_MODEL || "llama-3.1-8b-instant",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8e3,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_GROQ_MODEL || "llama-3.3-70b-versatile",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8e3,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_GROQ_MODEL || "llama-3.2-90b-vision-preview",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8e3,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["embedding" /* EMBEDDING */]: {
        name: settings_default.EMBEDDING_GROQ_MODEL || "llama-3.1-8b-instant"
      }
    }
  },
  ["llama_cloud" /* LLAMACLOUD */]: {
    endpoint: "https://api.llamacloud.com/v1",
    model: {
      ["small" /* SMALL */]: {
        name: "meta-llama/Llama-3.2-3B-Instruct-Turbo",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: "meta-llama-3.1-8b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["embedding" /* EMBEDDING */]: {
        name: "togethercomputer/m2-bert-80M-32k-retrieval"
      },
      ["image" /* IMAGE */]: {
        name: "black-forest-labs/FLUX.1-schnell",
        steps: 4
      }
    }
  },
  ["together" /* TOGETHER */]: {
    endpoint: "https://api.together.ai/v1",
    model: {
      ["small" /* SMALL */]: {
        name: "meta-llama/Llama-3.2-3B-Instruct-Turbo",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo-128K",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["embedding" /* EMBEDDING */]: {
        name: "togethercomputer/m2-bert-80M-32k-retrieval"
      },
      ["image" /* IMAGE */]: {
        name: "black-forest-labs/FLUX.1-schnell",
        steps: 4
      }
    }
  },
  ["llama_local" /* LLAMALOCAL */]: {
    model: {
      ["small" /* SMALL */]: {
        name: "NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true",
        stop: ["<|eot_id|>", "<|eom_id|>"],
        maxInputTokens: 32768,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: "NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true",
        // TODO: ?download=true
        stop: ["<|eot_id|>", "<|eom_id|>"],
        maxInputTokens: 32768,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: "NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q8_0.gguf?download=true",
        // "RichardErkhov/NousResearch_-_Meta-Llama-3.1-70B-gguf", // TODO:
        stop: ["<|eot_id|>", "<|eom_id|>"],
        maxInputTokens: 32768,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["embedding" /* EMBEDDING */]: {
        name: "togethercomputer/m2-bert-80M-32k-retrieval"
      }
    }
  },
  ["lmstudio" /* LMSTUDIO */]: {
    endpoint: settings_default.LMSTUDIO_SERVER_URL || "http://localhost:1234/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_LMSTUDIO_MODEL || settings_default.LMSTUDIO_MODEL || "hermes-3-llama-3.1-8b",
        stop: ["<|eot_id|>", "<|eom_id|>"],
        maxInputTokens: 32768,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_LMSTUDIO_MODEL || settings_default.LMSTUDIO_MODEL || "hermes-3-llama-3.1-8b",
        stop: ["<|eot_id|>", "<|eom_id|>"],
        maxInputTokens: 32768,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_LMSTUDIO_MODEL || settings_default.LMSTUDIO_MODEL || "hermes-3-llama-3.1-8b",
        stop: ["<|eot_id|>", "<|eom_id|>"],
        maxInputTokens: 32768,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      }
    }
  },
  ["google" /* GOOGLE */]: {
    endpoint: "https://generativelanguage.googleapis.com",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_GOOGLE_MODEL || settings_default.GOOGLE_MODEL || "gemini-2.0-flash-exp",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_GOOGLE_MODEL || settings_default.GOOGLE_MODEL || "gemini-2.0-flash-exp",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_GOOGLE_MODEL || settings_default.GOOGLE_MODEL || "gemini-2.0-flash-exp",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["embedding" /* EMBEDDING */]: {
        name: settings_default.EMBEDDING_GOOGLE_MODEL || settings_default.GOOGLE_MODEL || "text-embedding-004"
      }
    }
  },
  ["mistral" /* MISTRAL */]: {
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_MISTRAL_MODEL || settings_default.MISTRAL_MODEL || "mistral-small-latest",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_MISTRAL_MODEL || settings_default.MISTRAL_MODEL || "mistral-large-latest",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_MISTRAL_MODEL || settings_default.MISTRAL_MODEL || "mistral-large-latest",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      }
    }
  },
  ["redpill" /* REDPILL */]: {
    endpoint: "https://api.red-pill.ai/v1",
    // Available models: https://docs.red-pill.ai/get-started/supported-models
    // To test other models, change the models below
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_REDPILL_MODEL || settings_default.REDPILL_MODEL || "gpt-4o-mini",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_REDPILL_MODEL || settings_default.REDPILL_MODEL || "gpt-4o",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_REDPILL_MODEL || settings_default.REDPILL_MODEL || "gpt-4o",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["embedding" /* EMBEDDING */]: {
        name: "text-embedding-3-small"
      }
    }
  },
  ["openrouter" /* OPENROUTER */]: {
    endpoint: "https://openrouter.ai/api/v1",
    // Available models: https://openrouter.ai/models
    // To test other models, change the models below
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_OPENROUTER_MODEL || settings_default.OPENROUTER_MODEL || "nousresearch/hermes-3-llama-3.1-405b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_OPENROUTER_MODEL || settings_default.OPENROUTER_MODEL || "nousresearch/hermes-3-llama-3.1-405b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_OPENROUTER_MODEL || settings_default.OPENROUTER_MODEL || "nousresearch/hermes-3-llama-3.1-405b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["embedding" /* EMBEDDING */]: {
        name: "text-embedding-3-small"
      }
    }
  },
  ["ollama" /* OLLAMA */]: {
    endpoint: settings_default.OLLAMA_SERVER_URL || "http://localhost:11434",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_OLLAMA_MODEL || settings_default.OLLAMA_MODEL || "llama3.2",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_OLLAMA_MODEL || settings_default.OLLAMA_MODEL || "hermes3",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_OLLAMA_MODEL || settings_default.OLLAMA_MODEL || "hermes3:70b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.7
      },
      ["embedding" /* EMBEDDING */]: {
        name: settings_default.OLLAMA_EMBEDDING_MODEL || "mxbai-embed-large",
        dimensions: 1024
      }
    }
  },
  ["heurist" /* HEURIST */]: {
    endpoint: "https://llm-gateway.heurist.xyz",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_HEURIST_MODEL || "meta-llama/llama-3-70b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_HEURIST_MODEL || "meta-llama/llama-3-70b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_HEURIST_MODEL || "meta-llama/llama-3.3-70b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["image" /* IMAGE */]: {
        name: settings_default.HEURIST_IMAGE_MODEL || "FLUX.1-dev",
        steps: 20
      },
      ["embedding" /* EMBEDDING */]: {
        name: "BAAI/bge-large-en-v1.5",
        dimensions: 1024
      }
    }
  },
  ["galadriel" /* GALADRIEL */]: {
    endpoint: "https://api.galadriel.com/v1/verified",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_GALADRIEL_MODEL || "gpt-4o-mini",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_GALADRIEL_MODEL || "gpt-4o",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_GALADRIEL_MODEL || "gpt-4o",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      }
    }
  },
  ["falai" /* FAL */]: {
    endpoint: "https://api.fal.ai/v1",
    model: {
      ["image" /* IMAGE */]: { name: "fal-ai/flux-lora", steps: 28 }
    }
  },
  ["gaianet" /* GAIANET */]: {
    endpoint: settings_default.GAIANET_SERVER_URL,
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.GAIANET_MODEL || settings_default.SMALL_GAIANET_MODEL || "llama3b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.GAIANET_MODEL || settings_default.MEDIUM_GAIANET_MODEL || "llama",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.GAIANET_MODEL || settings_default.LARGE_GAIANET_MODEL || "qwen72b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        repetition_penalty: 0.4,
        temperature: 0.7
      },
      ["embedding" /* EMBEDDING */]: {
        name: settings_default.GAIANET_EMBEDDING_MODEL || "nomic-embed",
        dimensions: 768
      }
    }
  },
  ["ali_bailian" /* ALI_BAILIAN */]: {
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: {
      ["small" /* SMALL */]: {
        name: "qwen-turbo",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: "qwen-plus",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: "qwen-max",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.6
      },
      ["image" /* IMAGE */]: {
        name: "wanx-v1"
      }
    }
  },
  ["volengine" /* VOLENGINE */]: {
    endpoint: settings_default.VOLENGINE_API_URL || "https://open.volcengineapi.com/api/v3/",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_VOLENGINE_MODEL || settings_default.VOLENGINE_MODEL || "doubao-lite-128k",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_VOLENGINE_MODEL || settings_default.VOLENGINE_MODEL || "doubao-pro-128k",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_VOLENGINE_MODEL || settings_default.VOLENGINE_MODEL || "doubao-pro-256k",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0.4,
        presence_penalty: 0.4,
        temperature: 0.6
      },
      ["embedding" /* EMBEDDING */]: {
        name: settings_default.VOLENGINE_EMBEDDING_MODEL || "doubao-embedding"
      }
    }
  },
  ["nanogpt" /* NANOGPT */]: {
    endpoint: "https://nano-gpt.com/api/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_NANOGPT_MODEL || "gpt-4o-mini",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_NANOGPT_MODEL || "gpt-4o",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_NANOGPT_MODEL || "gpt-4o",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6
      }
    }
  },
  ["hyperbolic" /* HYPERBOLIC */]: {
    endpoint: "https://api.hyperbolic.xyz/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_HYPERBOLIC_MODEL || settings_default.HYPERBOLIC_MODEL || "meta-llama/Llama-3.2-3B-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_HYPERBOLIC_MODEL || settings_default.HYPERBOLIC_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_HYPERBOLIC_MODEL || settings_default.HYPERBOLIC_MODEL || "meta-llama/Meta-Llama-3.1-405-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["image" /* IMAGE */]: {
        name: settings_default.IMAGE_HYPERBOLIC_MODEL || "FLUX.1-dev"
      }
    }
  },
  ["venice" /* VENICE */]: {
    endpoint: "https://api.venice.ai/api/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_VENICE_MODEL || "llama-3.3-70b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_VENICE_MODEL || "llama-3.3-70b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_VENICE_MODEL || "llama-3.1-405b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["image" /* IMAGE */]: {
        name: settings_default.IMAGE_VENICE_MODEL || "fluently-xl"
      }
    }
  },
  ["nvidia" /* NVIDIA */]: {
    endpoint: "https://integrate.api.nvidia.com/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_NVIDIA_MODEL || "meta/llama-3.2-3b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_NVIDIA_MODEL || "meta/llama-3.1-405b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      }
    }
  },
  ["nineteen_ai" /* NINETEEN_AI */]: {
    endpoint: "https://api.nineteen.ai/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_NINETEEN_AI_MODEL || "unsloth/Llama-3.2-3B-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_NINETEEN_AI_MODEL || "unsloth/Meta-Llama-3.1-8B-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_NINETEEN_AI_MODEL || "hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["image" /* IMAGE */]: {
        name: settings_default.IMAGE_NINETEEN_AI_MODEL || "dataautogpt3/ProteusV0.4-Lightning"
      }
    }
  },
  ["akash_chat_api" /* AKASH_CHAT_API */]: {
    endpoint: "https://chatapi.akash.network/api/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_AKASH_CHAT_API_MODEL || "Meta-Llama-3-2-3B-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_AKASH_CHAT_API_MODEL || "Meta-Llama-3-3-70B-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_AKASH_CHAT_API_MODEL || "Meta-Llama-3-1-405B-Instruct-FP8",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      }
    }
  },
  ["livepeer" /* LIVEPEER */]: {
    endpoint: settings_default.LIVEPEER_GATEWAY_URL || "http://gateway.test-gateway",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_LIVEPEER_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct",
        stop: [],
        maxInputTokens: 8e3,
        maxOutputTokens: 8192,
        temperature: 0
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_LIVEPEER_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct",
        stop: [],
        maxInputTokens: 8e3,
        maxOutputTokens: 8192,
        temperature: 0
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_LIVEPEER_MODEL || "meta-llama/Meta-Llama-3.1-8B-Instruct",
        stop: [],
        maxInputTokens: 8e3,
        maxOutputTokens: 8192,
        temperature: 0
      },
      ["image" /* IMAGE */]: {
        name: settings_default.IMAGE_LIVEPEER_MODEL || "ByteDance/SDXL-Lightning"
      }
    }
  },
  ["infera" /* INFERA */]: {
    endpoint: "https://api.infera.org",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_INFERA_MODEL || "llama3.2:3b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_INFERA_MODEL || "mistral-nemo:latest",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_INFERA_MODEL || "mistral-small:latest",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0
      }
    }
  },
  ["deepseek" /* DEEPSEEK */]: {
    endpoint: settings_default.DEEPSEEK_API_URL || "https://api.deepseek.com",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_DEEPSEEK_MODEL || "deepseek-chat",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_DEEPSEEK_MODEL || "deepseek-chat",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_DEEPSEEK_MODEL || "deepseek-chat",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.7
      }
    }
  },
  ["bedrock" /* BEDROCK */]: {
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_BEDROCK_MODEL || "amazon.nova-micro-v1:0",
        maxInputTokens: 128e3,
        maxOutputTokens: 5120,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6,
        stop: []
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_BEDROCK_MODEL || "amazon.nova-lite-v1:0",
        maxInputTokens: 128e3,
        maxOutputTokens: 5120,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6,
        stop: []
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_BEDROCK_MODEL || "amazon.nova-pro-v1:0",
        maxInputTokens: 128e3,
        maxOutputTokens: 5120,
        frequency_penalty: 0,
        presence_penalty: 0,
        temperature: 0.6,
        stop: []
      },
      ["embedding" /* EMBEDDING */]: {
        name: settings_default.EMBEDDING_BEDROCK_MODEL || "amazon.titan-embed-text-v1"
      },
      ["image" /* IMAGE */]: {
        name: settings_default.IMAGE_BEDROCK_MODEL || "amazon.nova-canvas-v1:0"
      }
    }
  },
  ["atoma" /* ATOMA */]: {
    endpoint: settings_default.ATOMA_API_URL || "https://api.atoma.network/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_ATOMA_MODEL || "meta-llama/Llama-3.3-70B-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_ATOMA_MODEL || "meta-llama/Llama-3.3-70B-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_ATOMA_MODEL || "meta-llama/Llama-3.3-70B-Instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.7
      }
    }
  },
  ["secret_ai" /* SECRETAI */]: {
    endpoint: settings_default.SECRET_AI_URL || "https://ai1.scrtlabs.com:21434",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_SECRET_AI_MODEL || "deepseek-r1:70b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.7
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_SECRET_AI_MODEL || "deepseek-r1:70b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.7
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_SECRET_AI_MODEL || "deepseek-r1:70b",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.7
      }
    }
  },
  ["nearai" /* NEARAI */]: {
    endpoint: settings_default.NEARAI_API_URL || "https://api.near.ai/v1",
    model: {
      ["small" /* SMALL */]: {
        name: settings_default.SMALL_NEARAI_MODEL || settings_default.NEARAI_MODEL || "fireworks::accounts/fireworks/models/llama-v3p2-3b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["medium" /* MEDIUM */]: {
        name: settings_default.MEDIUM_NEARAI_MODEL || settings_default.NEARAI_MODEL || "fireworks::accounts/fireworks/models/llama-v3p1-70b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["large" /* LARGE */]: {
        name: settings_default.LARGE_NEARAI_MODEL || settings_default.NEARAI_MODEL || "fireworks::accounts/fireworks/models/llama-v3p1-405b-instruct",
        stop: [],
        maxInputTokens: 128e3,
        maxOutputTokens: 8192,
        temperature: 0.6
      },
      ["image" /* IMAGE */]: {
        name: settings_default.IMAGE_NEARAI_MODEL || "fireworks::accounts/fireworks/models/playground-v2-5-1024px-aesthetic"
      }
    }
  }
};
function getModelSettings(provider, type) {
  return models[provider]?.model[type];
}
function getImageModelSettings(provider) {
  return models[provider]?.model["image" /* IMAGE */];
}
function getEmbeddingModelSettings(provider) {
  return models[provider]?.model["embedding" /* EMBEDDING */];
}
function getEndpoint(provider) {
  return models[provider].endpoint;
}

// src/localembeddingManager.ts
import path3 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { FlagEmbedding, EmbeddingModel } from "fastembed";
var LocalEmbeddingModelManager = class _LocalEmbeddingModelManager {
  static instance;
  model = null;
  initPromise = null;
  initializationLock = false;
  constructor() {
  }
  static getInstance() {
    if (!_LocalEmbeddingModelManager.instance) {
      _LocalEmbeddingModelManager.instance = new _LocalEmbeddingModelManager();
    }
    return _LocalEmbeddingModelManager.instance;
  }
  async getRootPath() {
    const __filename2 = fileURLToPath2(import.meta.url);
    const __dirname2 = path3.dirname(__filename2);
    const rootPath = path3.resolve(__dirname2, "..");
    return rootPath.includes("/eliza/") ? rootPath.split("/eliza/")[0] + "/eliza/" : path3.resolve(__dirname2, "..");
  }
  async initialize() {
    if (this.model) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    if (this.initializationLock) {
      while (this.initializationLock) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return;
    }
    this.initializationLock = true;
    try {
      this.initPromise = this.initializeModel();
      await this.initPromise;
    } finally {
      this.initializationLock = false;
      this.initPromise = null;
    }
  }
  async initializeModel() {
    const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
    if (!isNode) {
      throw new Error("Local embedding not supported in browser");
    }
    try {
      const fs4 = await import("fs");
      const cacheDir = await this.getRootPath() + "/cache/";
      if (!fs4.existsSync(cacheDir)) {
        fs4.mkdirSync(cacheDir, { recursive: true });
      }
      logger_default.debug("Initializing BGE embedding model...");
      this.model = await FlagEmbedding.init({
        cacheDir,
        model: EmbeddingModel.BGESmallENV15,
        maxLength: 512
      });
      logger_default.debug("BGE model initialized successfully");
    } catch (error) {
      logger_default.error("Failed to initialize BGE model:", error);
      throw error;
    }
  }
  async generateEmbedding(input) {
    if (!this.model) {
      await this.initialize();
    }
    if (!this.model) {
      throw new Error("Failed to initialize model");
    }
    try {
      const embedding = await this.model.queryEmbed(input);
      return this.processEmbedding(embedding);
    } catch (error) {
      logger_default.error("Embedding generation failed:", error);
      throw error;
    }
  }
  processEmbedding(embedding) {
    let finalEmbedding;
    if (ArrayBuffer.isView(embedding) && embedding.constructor === Float32Array) {
      finalEmbedding = Array.from(embedding);
    } else if (Array.isArray(embedding) && ArrayBuffer.isView(embedding[0]) && embedding[0].constructor === Float32Array) {
      finalEmbedding = Array.from(embedding[0]);
    } else if (Array.isArray(embedding)) {
      finalEmbedding = embedding;
    } else {
      throw new Error(`Unexpected embedding format: ${typeof embedding}`);
    }
    finalEmbedding = finalEmbedding.map((n) => Number(n));
    if (!Array.isArray(finalEmbedding) || finalEmbedding[0] === void 0) {
      throw new Error(
        "Invalid embedding format: must be an array starting with a number"
      );
    }
    if (finalEmbedding.length !== 384) {
      logger_default.warn(
        `Unexpected embedding dimension: ${finalEmbedding.length}`
      );
    }
    return finalEmbedding;
  }
  async reset() {
    if (this.model) {
      this.model = null;
    }
    this.initPromise = null;
    this.initializationLock = false;
  }
  // For testing purposes
  static resetInstance() {
    if (_LocalEmbeddingModelManager.instance) {
      _LocalEmbeddingModelManager.instance.reset();
      _LocalEmbeddingModelManager.instance = null;
    }
  }
};
var localembeddingManager_default = LocalEmbeddingModelManager;

// src/embedding.ts
var EmbeddingProvider = {
  OpenAI: "OpenAI",
  Ollama: "Ollama",
  GaiaNet: "GaiaNet",
  Heurist: "Heurist",
  BGE: "BGE"
};
var getEmbeddingConfig = () => ({
  dimensions: settings_default.USE_OPENAI_EMBEDDING?.toLowerCase() === "true" ? getEmbeddingModelSettings("openai" /* OPENAI */).dimensions : settings_default.USE_OLLAMA_EMBEDDING?.toLowerCase() === "true" ? getEmbeddingModelSettings("ollama" /* OLLAMA */).dimensions : settings_default.USE_GAIANET_EMBEDDING?.toLowerCase() === "true" ? getEmbeddingModelSettings("gaianet" /* GAIANET */).dimensions : settings_default.USE_HEURIST_EMBEDDING?.toLowerCase() === "true" ? getEmbeddingModelSettings("heurist" /* HEURIST */).dimensions : 384,
  // BGE
  model: settings_default.USE_OPENAI_EMBEDDING?.toLowerCase() === "true" ? getEmbeddingModelSettings("openai" /* OPENAI */).name : settings_default.USE_OLLAMA_EMBEDDING?.toLowerCase() === "true" ? getEmbeddingModelSettings("ollama" /* OLLAMA */).name : settings_default.USE_GAIANET_EMBEDDING?.toLowerCase() === "true" ? getEmbeddingModelSettings("gaianet" /* GAIANET */).name : settings_default.USE_HEURIST_EMBEDDING?.toLowerCase() === "true" ? getEmbeddingModelSettings("heurist" /* HEURIST */).name : "BGE-small-en-v1.5",
  provider: settings_default.USE_OPENAI_EMBEDDING?.toLowerCase() === "true" ? "OpenAI" : settings_default.USE_OLLAMA_EMBEDDING?.toLowerCase() === "true" ? "Ollama" : settings_default.USE_GAIANET_EMBEDDING?.toLowerCase() === "true" ? "GaiaNet" : settings_default.USE_HEURIST_EMBEDDING?.toLowerCase() === "true" ? "Heurist" : "BGE"
});
async function getRemoteEmbedding(input, options2) {
  const baseEndpoint = options2.endpoint.endsWith("/v1") ? options2.endpoint : `${options2.endpoint}${options2.isOllama ? "/v1" : ""}`;
  const fullUrl = `${baseEndpoint}/embeddings`;
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options2.apiKey ? {
        Authorization: `Bearer ${options2.apiKey}`
      } : {}
    },
    body: JSON.stringify({
      input,
      model: options2.model,
      dimensions: options2.dimensions || options2.length || getEmbeddingConfig().dimensions
      // Prefer dimensions, fallback to length
    })
  };
  try {
    const response = await fetch(fullUrl, requestOptions);
    if (!response.ok) {
      logger_default.error("API Response:", await response.text());
      throw new Error(
        `Embedding API Error: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();
    return data?.data?.[0].embedding;
  } catch (e) {
    logger_default.error("Full error details:", e);
    throw e;
  }
}
function getEmbeddingType(runtime) {
  const isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
  const isLocal = isNode && runtime.character.modelProvider !== "openai" /* OPENAI */ && runtime.character.modelProvider !== "gaianet" /* GAIANET */ && runtime.character.modelProvider !== "heurist" /* HEURIST */ && !settings_default.USE_OPENAI_EMBEDDING;
  return isLocal ? "local" : "remote";
}
function getEmbeddingZeroVector() {
  let embeddingDimension = 384;
  if (settings_default.USE_OPENAI_EMBEDDING?.toLowerCase() === "true") {
    embeddingDimension = getEmbeddingModelSettings(
      "openai" /* OPENAI */
    ).dimensions;
  } else if (settings_default.USE_OLLAMA_EMBEDDING?.toLowerCase() === "true") {
    embeddingDimension = getEmbeddingModelSettings(
      "ollama" /* OLLAMA */
    ).dimensions;
  } else if (settings_default.USE_GAIANET_EMBEDDING?.toLowerCase() === "true") {
    embeddingDimension = getEmbeddingModelSettings(
      "gaianet" /* GAIANET */
    ).dimensions;
  } else if (settings_default.USE_HEURIST_EMBEDDING?.toLowerCase() === "true") {
    embeddingDimension = getEmbeddingModelSettings(
      "heurist" /* HEURIST */
    ).dimensions;
  }
  return Array(embeddingDimension).fill(0);
}
async function embed(runtime, input) {
  logger_default.debug("Embedding request:", {
    modelProvider: runtime.character.modelProvider,
    useOpenAI: process.env.USE_OPENAI_EMBEDDING,
    input: input?.slice(0, 50) + "...",
    inputType: typeof input,
    inputLength: input?.length,
    isString: typeof input === "string",
    isEmpty: !input
  });
  if (!input || typeof input !== "string" || input.trim().length === 0) {
    logger_default.warn("Invalid embedding input:", {
      input,
      type: typeof input,
      length: input?.length
    });
    return [];
  }
  const cachedEmbedding = await retrieveCachedEmbedding(runtime, input);
  if (cachedEmbedding) return cachedEmbedding;
  const config2 = getEmbeddingConfig();
  const isNode = typeof process !== "undefined" && process.versions?.node;
  if (config2.provider === EmbeddingProvider.OpenAI) {
    return await getRemoteEmbedding(input, {
      model: config2.model,
      endpoint: settings_default.OPENAI_API_URL || "https://api.openai.com/v1",
      apiKey: settings_default.OPENAI_API_KEY,
      dimensions: config2.dimensions
    });
  }
  if (config2.provider === EmbeddingProvider.Ollama) {
    return await getRemoteEmbedding(input, {
      model: config2.model,
      endpoint: runtime.character.modelEndpointOverride || getEndpoint("ollama" /* OLLAMA */),
      isOllama: true,
      dimensions: config2.dimensions
    });
  }
  if (config2.provider == EmbeddingProvider.GaiaNet) {
    return await getRemoteEmbedding(input, {
      model: config2.model,
      endpoint: runtime.character.modelEndpointOverride || getEndpoint("gaianet" /* GAIANET */) || settings_default.SMALL_GAIANET_SERVER_URL || settings_default.MEDIUM_GAIANET_SERVER_URL || settings_default.LARGE_GAIANET_SERVER_URL,
      apiKey: settings_default.GAIANET_API_KEY || runtime.token,
      dimensions: config2.dimensions
    });
  }
  if (config2.provider === EmbeddingProvider.Heurist) {
    return await getRemoteEmbedding(input, {
      model: config2.model,
      endpoint: getEndpoint("heurist" /* HEURIST */),
      apiKey: runtime.token,
      dimensions: config2.dimensions
    });
  }
  if (isNode) {
    try {
      return await getLocalEmbedding(input);
    } catch (error) {
      logger_default.warn(
        "Local embedding failed, falling back to remote",
        error
      );
    }
  }
  return await getRemoteEmbedding(input, {
    model: config2.model,
    endpoint: runtime.character.modelEndpointOverride || getEndpoint(runtime.character.modelProvider),
    apiKey: runtime.token,
    dimensions: config2.dimensions
  });
  async function getLocalEmbedding(input2) {
    logger_default.debug("DEBUG - Inside getLocalEmbedding function");
    try {
      const embeddingManager = localembeddingManager_default.getInstance();
      return await embeddingManager.generateEmbedding(input2);
    } catch (error) {
      logger_default.error("Local embedding failed:", error);
      throw error;
    }
  }
  async function retrieveCachedEmbedding(runtime2, input2) {
    if (!input2) {
      logger_default.log("No input to retrieve cached embedding for");
      return null;
    }
    const similaritySearchResult = await runtime2.messageManager.getCachedEmbeddings(input2);
    if (similaritySearchResult.length > 0) {
      return similaritySearchResult[0].embedding;
    }
    return null;
  }
}

// src/evaluators.ts
import { names as names3, uniqueNamesGenerator as uniqueNamesGenerator3 } from "unique-names-generator";
var evaluationTemplate = `TASK: Based on the conversation and conditions, determine which evaluation functions are appropriate to call.
Examples:
{{evaluatorExamples}}

INSTRUCTIONS: You are helping me to decide which appropriate functions to call based on the conversation between {{senderName}} and {{agentName}}.

{{recentMessages}}

Evaluator Functions:
{{evaluators}}

TASK: Based on the most recent conversation, determine which evaluators functions are appropriate to call to call.
Include the name of evaluators that are relevant and should be called in the array
Available evaluator names to include are {{evaluatorNames}}
` + stringArrayFooter;
function formatEvaluatorNames(evaluators) {
  return evaluators.map((evaluator) => `'${evaluator.name}'`).join(",\n");
}
function formatEvaluators(evaluators) {
  return evaluators.map(
    (evaluator) => `'${evaluator.name}: ${evaluator.description}'`
  ).join(",\n");
}
function formatEvaluatorExamples(evaluators) {
  return evaluators.map((evaluator) => {
    return evaluator.examples.map((example) => {
      const exampleNames = Array.from(
        { length: 5 },
        () => uniqueNamesGenerator3({ dictionaries: [names3] })
      );
      let formattedContext = example.context;
      let formattedOutcome = example.outcome;
      exampleNames.forEach((name, index) => {
        const placeholder = `{{user${index + 1}}}`;
        formattedContext = formattedContext.replaceAll(
          placeholder,
          name
        );
        formattedOutcome = formattedOutcome.replaceAll(
          placeholder,
          name
        );
      });
      const formattedMessages = example.messages.map((message) => {
        let messageString = `${message.user}: ${message.content.text}`;
        exampleNames.forEach((name, index) => {
          const placeholder = `{{user${index + 1}}}`;
          messageString = messageString.replaceAll(
            placeholder,
            name
          );
        });
        return messageString + (message.content.action ? ` (${message.content.action})` : "");
      }).join("\n");
      return `Context:
${formattedContext}

Messages:
${formattedMessages}

Outcome:
${formattedOutcome}`;
    }).join("\n\n");
  }).join("\n\n");
}
function formatEvaluatorExampleDescriptions(evaluators) {
  return evaluators.map(
    (evaluator) => evaluator.examples.map(
      (_example, index) => `${evaluator.name} Example ${index + 1}: ${evaluator.description}`
    ).join("\n")
  ).join("\n\n");
}

// src/generation.ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { bedrock } from "@ai-sdk/amazon-bedrock";
import {
  generateObject as aiGenerateObject,
  generateText as aiGenerateText
} from "ai";
import { Buffer } from "buffer";
import { createOllama } from "ollama-ai-provider";
import OpenAI from "openai";
import { encodingForModel } from "js-tiktoken";
import Together from "together-ai";
import { fal } from "@fal-ai/client";
import BigNumber from "bignumber.js";
import { createPublicClient, http } from "viem";
import fs2 from "fs";
import os from "os";
import path4 from "path";
async function trimTokens(context, maxTokens, runtime) {
  if (!context) return "";
  if (maxTokens <= 0) throw new Error("maxTokens must be positive");
  const tokenizerModel = runtime.getSetting("TOKENIZER_MODEL");
  const tokenizerType = runtime.getSetting("TOKENIZER_TYPE");
  if (!tokenizerModel || !tokenizerType) {
    return truncateTiktoken("gpt-4o", context, maxTokens);
  }
  if (tokenizerType === "tiktoken" /* TikToken */) {
    return truncateTiktoken(
      tokenizerModel,
      context,
      maxTokens
    );
  }
  elizaLogger.warn(`Unsupported tokenizer type: ${tokenizerType}`);
  return truncateTiktoken("gpt-4o", context, maxTokens);
}
async function truncateTiktoken(model, context, maxTokens) {
  try {
    const encoding = encodingForModel(model);
    const tokens = encoding.encode(context);
    if (tokens.length <= maxTokens) {
      return context;
    }
    const truncatedTokens = tokens.slice(-maxTokens);
    return encoding.decode(truncatedTokens);
  } catch (error) {
    elizaLogger.error("Error in trimTokens:", error);
    return context.slice(-maxTokens * 4);
  }
}
async function getOnChainEternalAISystemPrompt(runtime) {
  const agentId = runtime.getSetting("ETERNALAI_AGENT_ID");
  const providerUrl = runtime.getSetting("ETERNALAI_RPC_URL");
  const contractAddress = runtime.getSetting(
    "ETERNALAI_AGENT_CONTRACT_ADDRESS"
  );
  if (agentId && providerUrl && contractAddress) {
    const contractABI = [
      {
        inputs: [
          {
            internalType: "uint256",
            name: "_agentId",
            type: "uint256"
          }
        ],
        name: "getAgentSystemPrompt",
        outputs: [
          { internalType: "bytes[]", name: "", type: "bytes[]" }
        ],
        stateMutability: "view",
        type: "function"
      }
    ];
    const publicClient = createPublicClient({
      transport: http(providerUrl)
    });
    try {
      const validAddress = contractAddress;
      const result = await publicClient.readContract({
        address: validAddress,
        abi: contractABI,
        functionName: "getAgentSystemPrompt",
        args: [new BigNumber(agentId)]
      });
      if (result) {
        elizaLogger.info("on-chain system-prompt response", result[0]);
        const value = result[0].toString().replace("0x", "");
        const content = Buffer.from(value, "hex").toString("utf-8");
        elizaLogger.info("on-chain system-prompt", content);
        return await fetchEternalAISystemPrompt(runtime, content);
      } else {
        return void 0;
      }
    } catch (error) {
      elizaLogger.error(error);
      elizaLogger.error("err", error);
    }
  }
  return void 0;
}
async function fetchEternalAISystemPrompt(runtime, content) {
  const IPFS = "ipfs://";
  const containsSubstring = content.includes(IPFS);
  if (containsSubstring) {
    const lightHouse = content.replace(
      IPFS,
      "https://gateway.lighthouse.storage/ipfs/"
    );
    elizaLogger.info("fetch lightHouse", lightHouse);
    const responseLH = await fetch(lightHouse, {
      method: "GET"
    });
    elizaLogger.info("fetch lightHouse resp", responseLH);
    if (responseLH.ok) {
      const data = await responseLH.text();
      return data;
    } else {
      const gcs = content.replace(
        IPFS,
        "https://cdn.eternalai.org/upload/"
      );
      elizaLogger.info("fetch gcs", gcs);
      const responseGCS = await fetch(gcs, {
        method: "GET"
      });
      elizaLogger.info("fetch lightHouse gcs", responseGCS);
      if (responseGCS.ok) {
        const data = await responseGCS.text();
        return data;
      } else {
        throw new Error("invalid on-chain system prompt");
      }
    }
  } else {
    return content;
  }
}
function getCloudflareGatewayBaseURL(runtime, provider) {
  const isCloudflareEnabled = runtime.getSetting("CLOUDFLARE_GW_ENABLED") === "true";
  const cloudflareAccountId = runtime.getSetting("CLOUDFLARE_AI_ACCOUNT_ID");
  const cloudflareGatewayId = runtime.getSetting("CLOUDFLARE_AI_GATEWAY_ID");
  elizaLogger.debug("Cloudflare Gateway Configuration:", {
    isEnabled: isCloudflareEnabled,
    hasAccountId: !!cloudflareAccountId,
    hasGatewayId: !!cloudflareGatewayId,
    provider
  });
  if (!isCloudflareEnabled) {
    elizaLogger.debug("Cloudflare Gateway is not enabled");
    return void 0;
  }
  if (!cloudflareAccountId) {
    elizaLogger.warn(
      "Cloudflare Gateway is enabled but CLOUDFLARE_AI_ACCOUNT_ID is not set"
    );
    return void 0;
  }
  if (!cloudflareGatewayId) {
    elizaLogger.warn(
      "Cloudflare Gateway is enabled but CLOUDFLARE_AI_GATEWAY_ID is not set"
    );
    return void 0;
  }
  const baseURL = `https://gateway.ai.cloudflare.com/v1/${cloudflareAccountId}/${cloudflareGatewayId}/${provider.toLowerCase()}`;
  elizaLogger.info("Using Cloudflare Gateway:", {
    provider,
    baseURL,
    accountId: cloudflareAccountId,
    gatewayId: cloudflareGatewayId
  });
  return baseURL;
}
async function generateText({
  runtime,
  context,
  modelClass,
  tools = {},
  onStepFinish,
  maxSteps = 1,
  stop,
  customSystemPrompt
}) {
  if (!context) {
    console.error("generateText context is empty");
    return "";
  }
  elizaLogger.log("Generating text...");
  elizaLogger.info("Generating text with options:", {
    modelProvider: runtime.modelProvider,
    model: modelClass
    // verifiableInference,
  });
  elizaLogger.log("Using provider:", runtime.modelProvider);
  const provider = runtime.modelProvider;
  elizaLogger.debug("Provider settings:", {
    provider,
    hasRuntime: !!runtime,
    runtimeSettings: {
      CLOUDFLARE_GW_ENABLED: runtime.getSetting("CLOUDFLARE_GW_ENABLED"),
      CLOUDFLARE_AI_ACCOUNT_ID: runtime.getSetting(
        "CLOUDFLARE_AI_ACCOUNT_ID"
      ),
      CLOUDFLARE_AI_GATEWAY_ID: runtime.getSetting(
        "CLOUDFLARE_AI_GATEWAY_ID"
      )
    }
  });
  const endpoint = runtime.character.modelEndpointOverride || getEndpoint(provider);
  const modelSettings = getModelSettings(runtime.modelProvider, modelClass);
  let model = modelSettings.name;
  switch (provider) {
    // if runtime.getSetting("LLAMACLOUD_MODEL_LARGE") is true and modelProvider is LLAMACLOUD, then use the large model
    case "llama_cloud" /* LLAMACLOUD */:
      {
        switch (modelClass) {
          case "large" /* LARGE */:
            {
              model = runtime.getSetting("LLAMACLOUD_MODEL_LARGE") || model;
            }
            break;
          case "small" /* SMALL */:
            {
              model = runtime.getSetting("LLAMACLOUD_MODEL_SMALL") || model;
            }
            break;
        }
      }
      break;
    case "together" /* TOGETHER */:
      {
        switch (modelClass) {
          case "large" /* LARGE */:
            {
              model = runtime.getSetting("TOGETHER_MODEL_LARGE") || model;
            }
            break;
          case "small" /* SMALL */:
            {
              model = runtime.getSetting("TOGETHER_MODEL_SMALL") || model;
            }
            break;
        }
      }
      break;
    case "openrouter" /* OPENROUTER */:
      {
        switch (modelClass) {
          case "large" /* LARGE */:
            {
              model = runtime.getSetting("LARGE_OPENROUTER_MODEL") || model;
            }
            break;
          case "small" /* SMALL */:
            {
              model = runtime.getSetting("SMALL_OPENROUTER_MODEL") || model;
            }
            break;
        }
      }
      break;
  }
  elizaLogger.info("Selected model:", model);
  const modelConfiguration = runtime.character?.settings?.modelConfig;
  const temperature = modelConfiguration?.temperature || modelSettings.temperature;
  const frequency_penalty = modelConfiguration?.frequency_penalty || modelSettings.frequency_penalty;
  const presence_penalty = modelConfiguration?.presence_penalty || modelSettings.presence_penalty;
  const max_context_length = modelConfiguration?.maxInputTokens || modelSettings.maxInputTokens;
  const max_response_length = modelConfiguration?.maxOutputTokens || modelSettings.maxOutputTokens;
  const experimental_telemetry = modelConfiguration?.experimental_telemetry || modelSettings.experimental_telemetry;
  const apiKey = runtime.token;
  try {
    elizaLogger.debug(
      `Trimming context to max length of ${max_context_length} tokens.`
    );
    context = await trimTokens(context, max_context_length, runtime);
    let response;
    const _stop = stop || modelSettings.stop;
    elizaLogger.debug(
      `Using provider: ${provider}, model: ${model}, temperature: ${temperature}, max response length: ${max_response_length}`
    );
    switch (provider) {
      // OPENAI & LLAMACLOUD shared same structure.
      case "openai" /* OPENAI */:
      case "ali_bailian" /* ALI_BAILIAN */:
      case "volengine" /* VOLENGINE */:
      case "llama_cloud" /* LLAMACLOUD */:
      case "nanogpt" /* NANOGPT */:
      case "hyperbolic" /* HYPERBOLIC */:
      case "together" /* TOGETHER */:
      case "nineteen_ai" /* NINETEEN_AI */:
      case "akash_chat_api" /* AKASH_CHAT_API */:
      case "lmstudio" /* LMSTUDIO */:
      case "nearai" /* NEARAI */: {
        elizaLogger.debug(
          "Initializing OpenAI model with Cloudflare check"
        );
        const baseURL2 = getCloudflareGatewayBaseURL(runtime, "openai") || endpoint;
        const openai = createOpenAI({
          apiKey,
          baseURL: baseURL2,
          fetch: runtime.fetch
        });
        const { text: openaiResponse } = await aiGenerateText({
          model: openai.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = openaiResponse;
        console.log("Received response from OpenAI model.");
        break;
      }
      case "eternalai" /* ETERNALAI */: {
        elizaLogger.debug("Initializing EternalAI model.");
        const openai = createOpenAI({
          apiKey,
          baseURL: endpoint,
          fetch: async (input, init) => {
            const url = typeof input === "string" ? input : input.toString();
            const chain_id = runtime.getSetting("ETERNALAI_CHAIN_ID") || "45762";
            const options2 = { ...init };
            if (options2?.body) {
              const body = JSON.parse(options2.body);
              body.chain_id = chain_id;
              options2.body = JSON.stringify(body);
            }
            const fetching = await runtime.fetch(url, options2);
            if (parseBooleanFromText(
              runtime.getSetting("ETERNALAI_LOG")
            )) {
              elizaLogger.info(
                "Request data: ",
                JSON.stringify(options2, null, 2)
              );
              const clonedResponse = fetching.clone();
              try {
                clonedResponse.json().then((data) => {
                  elizaLogger.info(
                    "Response data: ",
                    JSON.stringify(data, null, 2)
                  );
                });
              } catch (e) {
                elizaLogger.debug(e);
              }
            }
            return fetching;
          }
        });
        let system_prompt = runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0;
        try {
          const on_chain_system_prompt = await getOnChainEternalAISystemPrompt(runtime);
          if (!on_chain_system_prompt) {
            elizaLogger.error(
              new Error("invalid on_chain_system_prompt")
            );
          } else {
            system_prompt = on_chain_system_prompt;
            elizaLogger.info(
              "new on-chain system prompt",
              system_prompt
            );
          }
        } catch (e) {
          elizaLogger.error(e);
        }
        const { text: openaiResponse } = await aiGenerateText({
          model: openai.languageModel(model),
          prompt: context,
          system: system_prompt,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = openaiResponse;
        elizaLogger.debug("Received response from EternalAI model.");
        break;
      }
      case "google" /* GOOGLE */: {
        const google = createGoogleGenerativeAI({
          apiKey,
          fetch: runtime.fetch
        });
        const { text: googleResponse } = await aiGenerateText({
          model: google(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = googleResponse;
        elizaLogger.debug("Received response from Google model.");
        break;
      }
      case "mistral" /* MISTRAL */: {
        const mistral = createMistral();
        const { text: mistralResponse } = await aiGenerateText({
          model: mistral(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = mistralResponse;
        elizaLogger.debug("Received response from Mistral model.");
        break;
      }
      case "anthropic" /* ANTHROPIC */: {
        elizaLogger.debug(
          "Initializing Anthropic model with Cloudflare check"
        );
        const baseURL2 = getCloudflareGatewayBaseURL(runtime, "anthropic") || "https://api.anthropic.com/v1";
        elizaLogger.debug("Anthropic baseURL result:", { baseURL: baseURL2 });
        const anthropic = createAnthropic({
          apiKey,
          baseURL: baseURL2,
          fetch: runtime.fetch
        });
        const { text: anthropicResponse } = await aiGenerateText({
          model: anthropic.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = anthropicResponse;
        elizaLogger.debug("Received response from Anthropic model.");
        break;
      }
      case "claude_vertex" /* CLAUDE_VERTEX */: {
        elizaLogger.debug("Initializing Claude Vertex model.");
        const anthropic = createAnthropic({
          apiKey,
          fetch: runtime.fetch
        });
        const { text: anthropicResponse } = await aiGenerateText({
          model: anthropic.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = anthropicResponse;
        elizaLogger.debug(
          "Received response from Claude Vertex model."
        );
        break;
      }
      case "grok" /* GROK */: {
        elizaLogger.debug("Initializing Grok model.");
        const grok = createOpenAI({
          apiKey,
          baseURL: endpoint,
          fetch: runtime.fetch
        });
        const { text: grokResponse } = await aiGenerateText({
          model: grok.languageModel(model, {
            parallelToolCalls: false
          }),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = grokResponse;
        elizaLogger.debug("Received response from Grok model.");
        break;
      }
      case "groq" /* GROQ */: {
        elizaLogger.debug(
          "Initializing Groq model with Cloudflare check"
        );
        const baseURL2 = getCloudflareGatewayBaseURL(runtime, "groq");
        elizaLogger.debug("Groq baseURL result:", { baseURL: baseURL2 });
        const groq = createGroq({
          apiKey,
          fetch: runtime.fetch,
          baseURL: baseURL2
        });
        const { text: groqResponse } = await aiGenerateText({
          model: groq.languageModel(model),
          prompt: context,
          temperature,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = groqResponse;
        elizaLogger.debug("Received response from Groq model.");
        break;
      }
      case "llama_local" /* LLAMALOCAL */: {
        elizaLogger.debug(
          "Using local Llama model for text completion."
        );
        const textGenerationService = runtime.getService(
          "text_generation" /* TEXT_GENERATION */
        );
        if (!textGenerationService) {
          throw new Error("Text generation service not found");
        }
        response = await textGenerationService.queueTextCompletion(
          context,
          temperature,
          _stop,
          frequency_penalty,
          presence_penalty,
          max_response_length
        );
        elizaLogger.debug("Received response from local Llama model.");
        break;
      }
      case "redpill" /* REDPILL */: {
        elizaLogger.debug("Initializing RedPill model.");
        const serverUrl = getEndpoint(provider);
        const openai = createOpenAI({
          apiKey,
          baseURL: serverUrl,
          fetch: runtime.fetch
        });
        const { text: redpillResponse } = await aiGenerateText({
          model: openai.languageModel(model),
          prompt: context,
          temperature,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = redpillResponse;
        elizaLogger.debug("Received response from redpill model.");
        break;
      }
      case "openrouter" /* OPENROUTER */: {
        elizaLogger.debug("Initializing OpenRouter model.");
        const serverUrl = getEndpoint(provider);
        const openrouter = createOpenAI({
          apiKey,
          baseURL: serverUrl,
          fetch: runtime.fetch
        });
        const { text: openrouterResponse } = await aiGenerateText({
          model: openrouter.languageModel(model),
          prompt: context,
          temperature,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = openrouterResponse;
        elizaLogger.debug("Received response from OpenRouter model.");
        break;
      }
      case "ollama" /* OLLAMA */:
        {
          elizaLogger.debug("Initializing Ollama model.");
          const ollamaProvider = createOllama({
            baseURL: getEndpoint(provider) + "/api",
            fetch: runtime.fetch
          });
          const ollama = ollamaProvider(model);
          elizaLogger.debug("****** MODEL\n", model);
          const { text: ollamaResponse } = await aiGenerateText({
            model: ollama,
            prompt: context,
            tools,
            onStepFinish,
            temperature,
            maxSteps,
            maxTokens: max_response_length,
            frequencyPenalty: frequency_penalty,
            presencePenalty: presence_penalty,
            experimental_telemetry
          });
          response = ollamaResponse.replace(
            /<think>[\s\S]*?<\/think>\s*\n*/g,
            ""
          );
        }
        elizaLogger.debug("Received response from Ollama model.");
        break;
      case "heurist" /* HEURIST */: {
        elizaLogger.debug("Initializing Heurist model.");
        const heurist = createOpenAI({
          apiKey,
          baseURL: endpoint,
          fetch: runtime.fetch
        });
        const { text: heuristResponse } = await aiGenerateText({
          model: heurist.languageModel(model),
          prompt: context,
          system: customSystemPrompt ?? runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          temperature,
          maxTokens: max_response_length,
          maxSteps,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = heuristResponse;
        elizaLogger.debug("Received response from Heurist model.");
        break;
      }
      case "gaianet" /* GAIANET */: {
        elizaLogger.debug("Initializing GAIANET model.");
        var baseURL = getEndpoint(provider);
        if (!baseURL) {
          switch (modelClass) {
            case "small" /* SMALL */:
              baseURL = settings_default.SMALL_GAIANET_SERVER_URL || "https://llama3b.gaia.domains/v1";
              break;
            case "medium" /* MEDIUM */:
              baseURL = settings_default.MEDIUM_GAIANET_SERVER_URL || "https://llama8b.gaia.domains/v1";
              break;
            case "large" /* LARGE */:
              baseURL = settings_default.LARGE_GAIANET_SERVER_URL || "https://qwen72b.gaia.domains/v1";
              break;
          }
        }
        elizaLogger.debug("Using GAIANET model with baseURL:", baseURL);
        const openai = createOpenAI({
          apiKey,
          baseURL: endpoint,
          fetch: runtime.fetch
        });
        const { text: openaiResponse } = await aiGenerateText({
          model: openai.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = openaiResponse;
        elizaLogger.debug("Received response from GAIANET model.");
        break;
      }
      case "atoma" /* ATOMA */: {
        elizaLogger.debug("Initializing Atoma model.");
        const atoma = createOpenAI({
          apiKey,
          baseURL: endpoint,
          fetch: runtime.fetch
        });
        const { text: atomaResponse } = await aiGenerateText({
          model: atoma.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = atomaResponse;
        elizaLogger.debug("Received response from Atoma model.");
        break;
      }
      case "galadriel" /* GALADRIEL */: {
        elizaLogger.debug("Initializing Galadriel model.");
        const headers = {};
        const fineTuneApiKey = runtime.getSetting(
          "GALADRIEL_FINE_TUNE_API_KEY"
        );
        if (fineTuneApiKey) {
          headers["Fine-Tune-Authentication"] = fineTuneApiKey;
        }
        const galadriel = createOpenAI({
          headers,
          apiKey,
          baseURL: endpoint,
          fetch: runtime.fetch
        });
        const { text: galadrielResponse } = await aiGenerateText({
          model: galadriel.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = galadrielResponse;
        elizaLogger.debug("Received response from Galadriel model.");
        break;
      }
      case "infera" /* INFERA */: {
        elizaLogger.debug("Initializing Infera model.");
        const apiKey2 = settings_default.INFERA_API_KEY || runtime.token;
        const infera = createOpenAI({
          apiKey: apiKey2,
          baseURL: endpoint,
          headers: {
            api_key: apiKey2,
            "Content-Type": "application/json"
          }
        });
        const { text: inferaResponse } = await aiGenerateText({
          model: infera.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty
        });
        response = inferaResponse;
        elizaLogger.debug("Received response from Infera model.");
        break;
      }
      case "venice" /* VENICE */: {
        elizaLogger.debug("Initializing Venice model.");
        const venice = createOpenAI({
          apiKey,
          baseURL: endpoint
        });
        const { text: veniceResponse } = await aiGenerateText({
          model: venice.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          temperature,
          maxSteps,
          maxTokens: max_response_length
        });
        response = veniceResponse.replace(
          /<think>[\s\S]*?<\/think>\s*\n*/g,
          ""
        );
        elizaLogger.debug("Received response from Venice model.");
        break;
      }
      case "nvidia" /* NVIDIA */: {
        elizaLogger.debug("Initializing NVIDIA model.");
        const nvidia = createOpenAI({
          apiKey,
          baseURL: endpoint
        });
        const { text: nvidiaResponse } = await aiGenerateText({
          model: nvidia.languageModel(model),
          prompt: context,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          temperature,
          maxSteps,
          maxTokens: max_response_length
        });
        response = nvidiaResponse;
        elizaLogger.debug("Received response from NVIDIA model.");
        break;
      }
      case "deepseek" /* DEEPSEEK */: {
        elizaLogger.debug("Initializing Deepseek model.");
        const serverUrl = models[provider].endpoint;
        const deepseek = createOpenAI({
          apiKey,
          baseURL: serverUrl,
          fetch: runtime.fetch
        });
        const { text: deepseekResponse } = await aiGenerateText({
          model: deepseek.languageModel(model),
          prompt: context,
          temperature,
          system: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? void 0,
          tools,
          onStepFinish,
          maxSteps,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry
        });
        response = deepseekResponse;
        elizaLogger.debug("Received response from Deepseek model.");
        break;
      }
      case "livepeer" /* LIVEPEER */: {
        elizaLogger.debug("Initializing Livepeer model.");
        if (!endpoint) {
          throw new Error("Livepeer Gateway URL is not defined");
        }
        const requestBody = {
          model,
          messages: [
            {
              role: "system",
              content: runtime.character.system ?? settings_default.SYSTEM_PROMPT ?? "You are a helpful assistant"
            },
            {
              role: "user",
              content: context
            }
          ],
          max_tokens: max_response_length,
          stream: false
        };
        const fetchResponse = await runtime.fetch(endpoint + "/llm", {
          method: "POST",
          headers: {
            accept: "text/event-stream",
            "Content-Type": "application/json",
            Authorization: "Bearer eliza-app-llm"
          },
          body: JSON.stringify(requestBody)
        });
        if (!fetchResponse.ok) {
          const errorText = await fetchResponse.text();
          throw new Error(
            `Livepeer request failed (${fetchResponse.status}): ${errorText}`
          );
        }
        const json = await fetchResponse.json();
        if (!json?.choices?.[0]?.message?.content) {
          throw new Error("Invalid response format from Livepeer");
        }
        response = json.choices[0].message.content.replace(
          /<\|start_header_id\|>assistant<\|end_header_id\|>\n\n/,
          ""
        );
        elizaLogger.debug(
          "Successfully received response from Livepeer model"
        );
        break;
      }
      case "secret_ai" /* SECRETAI */:
        {
          elizaLogger.debug("Initializing SecretAI model.");
          const secretAiProvider = createOllama({
            baseURL: getEndpoint(provider) + "/api",
            fetch: runtime.fetch,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`
            }
          });
          const secretAi = secretAiProvider(model);
          const { text: secretAiResponse } = await aiGenerateText({
            model: secretAi,
            prompt: context,
            tools,
            onStepFinish,
            temperature,
            maxSteps,
            maxTokens: max_response_length
          });
          response = secretAiResponse;
        }
        break;
      case "bedrock" /* BEDROCK */: {
        elizaLogger.debug("Initializing Bedrock model.");
        const { text: bedrockResponse } = await aiGenerateText({
          model: bedrock(model),
          maxSteps,
          temperature,
          maxTokens: max_response_length,
          frequencyPenalty: frequency_penalty,
          presencePenalty: presence_penalty,
          experimental_telemetry,
          prompt: context
        });
        response = bedrockResponse;
        elizaLogger.debug("Received response from Bedrock model.");
        break;
      }
      default: {
        const errorMessage = `Unsupported provider: ${provider}`;
        elizaLogger.error(errorMessage);
        throw new Error(errorMessage);
      }
    }
    return response;
  } catch (error) {
    elizaLogger.error("Error in generateText:", error);
    throw error;
  }
}
async function generateShouldRespond({
  runtime,
  context,
  modelClass
}) {
  let retryDelay = 1e3;
  while (true) {
    try {
      elizaLogger.debug(
        "Attempting to generate text with context:",
        context
      );
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      elizaLogger.debug("Received response from generateText:", response);
      const parsedResponse = parseShouldRespondFromText(response.trim());
      if (parsedResponse) {
        elizaLogger.debug("Parsed response:", parsedResponse);
        return parsedResponse;
      } else {
        elizaLogger.debug("generateShouldRespond no response");
      }
    } catch (error) {
      elizaLogger.error("Error in generateShouldRespond:", error);
      if (error instanceof TypeError && error.message.includes("queueTextCompletion")) {
        elizaLogger.error(
          "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
        );
      }
    }
    elizaLogger.log(`Retrying in ${retryDelay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function splitChunks(content, chunkSize = 1500, bleed = 100) {
  elizaLogger.debug(`[splitChunks] Starting text split`);
  if (chunkSize <= 0) {
    elizaLogger.warn(
      `Invalid chunkSize (${chunkSize}), using default 1500`
    );
    chunkSize = 1500;
  }
  if (bleed >= chunkSize) {
    elizaLogger.warn(
      `Bleed (${bleed}) >= chunkSize (${chunkSize}), adjusting bleed to 1/4 of chunkSize`
    );
    bleed = Math.floor(chunkSize / 4);
  }
  if (bleed < 0) {
    elizaLogger.warn(`Invalid bleed (${bleed}), using default 100`);
    bleed = 100;
  }
  const chunks = splitText(content, chunkSize, bleed);
  elizaLogger.debug(`[splitChunks] Split complete:`, {
    numberOfChunks: chunks.length,
    averageChunkSize: chunks.reduce((acc, chunk) => acc + chunk.length, 0) / chunks.length
  });
  return chunks;
}
function splitText(content, chunkSize, bleed) {
  const chunks = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    if (end > start) {
      chunks.push(content.substring(start, end));
    }
    start = Math.max(end - bleed, start + 1);
  }
  return chunks;
}
async function generateTrueOrFalse({
  runtime,
  context = "",
  modelClass
}) {
  let retryDelay = 1e3;
  const modelSettings = getModelSettings(runtime.modelProvider, modelClass);
  const stop = Array.from(
    /* @__PURE__ */ new Set([...modelSettings.stop || [], ["\n"]])
  );
  while (true) {
    try {
      const response = await generateText({
        stop,
        runtime,
        context,
        modelClass
      });
      const parsedResponse = parseBooleanFromText(response.trim());
      if (parsedResponse !== null) {
        return parsedResponse;
      }
    } catch (error) {
      elizaLogger.error("Error in generateTrueOrFalse:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function generateTextArray({
  runtime,
  context,
  modelClass
}) {
  if (!context) {
    elizaLogger.error("generateTextArray context is empty");
    return [];
  }
  let retryDelay = 1e3;
  while (true) {
    try {
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      const parsedResponse = parseJsonArrayFromText(response);
      if (parsedResponse) {
        return parsedResponse;
      }
    } catch (error) {
      elizaLogger.error("Error in generateTextArray:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function generateObjectDeprecated({
  runtime,
  context,
  modelClass
}) {
  if (!context) {
    elizaLogger.error("generateObjectDeprecated context is empty");
    return null;
  }
  let retryDelay = 1e3;
  while (true) {
    try {
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      const parsedResponse = parseJSONObjectFromText(response);
      if (parsedResponse) {
        return parsedResponse;
      }
    } catch (error) {
      elizaLogger.error("Error in generateObject:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function generateObjectArray({
  runtime,
  context,
  modelClass
}) {
  if (!context) {
    elizaLogger.error("generateObjectArray context is empty");
    return [];
  }
  let retryDelay = 1e3;
  while (true) {
    try {
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      const parsedResponse = parseJsonArrayFromText(response);
      if (parsedResponse) {
        return parsedResponse;
      }
    } catch (error) {
      elizaLogger.error("Error in generateTextArray:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}
async function generateMessageResponse({
  runtime,
  context,
  modelClass
}) {
  const modelSettings = getModelSettings(runtime.modelProvider, modelClass);
  const max_context_length = modelSettings.maxInputTokens;
  context = await trimTokens(context, max_context_length, runtime);
  elizaLogger.debug("Context:", context);
  let retryLength = 1e3;
  while (true) {
    try {
      elizaLogger.log("Generating message response..");
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      const parsedContent = parseJSONObjectFromText(response);
      if (!parsedContent) {
        elizaLogger.debug("parsedContent is null, retrying");
        continue;
      }
      return parsedContent;
    } catch (error) {
      elizaLogger.error("ERROR:", error);
      retryLength *= 2;
      await new Promise((resolve) => setTimeout(resolve, retryLength));
      elizaLogger.debug("Retrying...");
    }
  }
}
var generateImage = async (data, runtime) => {
  const modelSettings = getImageModelSettings(runtime.imageModelProvider);
  if (!modelSettings) {
    elizaLogger.warn(
      "No model settings found for the image model provider."
    );
    return { success: false, error: "No model settings available" };
  }
  const model = modelSettings.name;
  elizaLogger.info("Generating image with options:", {
    imageModelProvider: model
  });
  const apiKey = runtime.imageModelProvider === runtime.modelProvider ? runtime.token : (() => {
    switch (runtime.imageModelProvider) {
      case "heurist" /* HEURIST */:
        return runtime.getSetting("HEURIST_API_KEY");
      case "together" /* TOGETHER */:
        return runtime.getSetting("TOGETHER_API_KEY");
      case "falai" /* FAL */:
        return runtime.getSetting("FAL_API_KEY");
      case "openai" /* OPENAI */:
        return runtime.getSetting("OPENAI_API_KEY");
      case "venice" /* VENICE */:
        return runtime.getSetting("VENICE_API_KEY");
      case "livepeer" /* LIVEPEER */:
        return runtime.getSetting("LIVEPEER_GATEWAY_URL");
      case "secret_ai" /* SECRETAI */:
        return runtime.getSetting("SECRET_AI_API_KEY");
      case "nearai" /* NEARAI */:
        try {
          const config2 = JSON.parse(
            fs2.readFileSync(
              path4.join(
                os.homedir(),
                ".nearai/config.json"
              ),
              "utf8"
            )
          );
          return JSON.stringify(config2?.auth);
        } catch (e) {
          elizaLogger.warn(
            `Error loading NEAR AI config. The environment variable NEARAI_API_KEY will be used. ${e}`
          );
        }
        return runtime.getSetting("NEARAI_API_KEY");
      default:
        return runtime.getSetting("HEURIST_API_KEY") ?? runtime.getSetting("NINETEEN_AI_API_KEY") ?? runtime.getSetting("TOGETHER_API_KEY") ?? runtime.getSetting("FAL_API_KEY") ?? runtime.getSetting("OPENAI_API_KEY") ?? runtime.getSetting("VENICE_API_KEY") ?? runtime.getSetting("LIVEPEER_GATEWAY_URL");
    }
  })();
  try {
    if (runtime.imageModelProvider === "heurist" /* HEURIST */) {
      const response = await fetch(
        "http://sequencer.heurist.xyz/submit_job",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            job_id: data.jobId || crypto.randomUUID(),
            model_input: {
              SD: {
                prompt: data.prompt,
                neg_prompt: data.negativePrompt,
                num_iterations: data.numIterations || 20,
                width: data.width || 512,
                height: data.height || 512,
                guidance_scale: data.guidanceScale || 3,
                seed: data.seed || -1
              }
            },
            model_id: model,
            deadline: 60,
            priority: 1
          })
        }
      );
      if (!response.ok) {
        throw new Error(
          `Heurist image generation failed: ${response.statusText}`
        );
      }
      const imageURL = await response.json();
      return { success: true, data: [imageURL] };
    } else if (runtime.imageModelProvider === "together" /* TOGETHER */ || // for backwards compat
    runtime.imageModelProvider === "llama_cloud" /* LLAMACLOUD */) {
      const together = new Together({ apiKey });
      const response = await together.images.create({
        model,
        prompt: data.prompt,
        width: data.width,
        height: data.height,
        steps: modelSettings?.steps ?? 4,
        n: data.count
      });
      const togetherResponse = response;
      if (!togetherResponse.data || !Array.isArray(togetherResponse.data)) {
        throw new Error("Invalid response format from Together AI");
      }
      const base64s = await Promise.all(
        togetherResponse.data.map(async (image) => {
          if (!image.url) {
            elizaLogger.error("Missing URL in image data:", image);
            throw new Error("Missing URL in Together AI response");
          }
          const imageResponse = await fetch(image.url);
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to fetch image: ${imageResponse.statusText}`
            );
          }
          const blob = await imageResponse.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          return `data:image/jpeg;base64,${base64}`;
        })
      );
      if (base64s.length === 0) {
        throw new Error("No images generated by Together AI");
      }
      elizaLogger.debug(`Generated ${base64s.length} images`);
      return { success: true, data: base64s };
    } else if (runtime.imageModelProvider === "falai" /* FAL */) {
      fal.config({
        credentials: apiKey
      });
      const input = {
        prompt: data.prompt,
        image_size: "square",
        num_inference_steps: modelSettings?.steps ?? 50,
        guidance_scale: data.guidanceScale || 3.5,
        num_images: data.count,
        enable_safety_checker: runtime.getSetting("FAL_AI_ENABLE_SAFETY_CHECKER") === "true",
        safety_tolerance: Number(
          runtime.getSetting("FAL_AI_SAFETY_TOLERANCE") || "2"
        ),
        output_format: "png",
        seed: data.seed ?? 6252023,
        ...runtime.getSetting("FAL_AI_LORA_PATH") ? {
          loras: [
            {
              path: runtime.getSetting("FAL_AI_LORA_PATH"),
              scale: 1
            }
          ]
        } : {}
      };
      const result = await fal.subscribe(model, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            elizaLogger.info(update.logs.map((log) => log.message));
          }
        }
      });
      const base64Promises = result.data.images.map(async (image) => {
        const response = await fetch(image.url);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        return `data:${image.content_type};base64,${base64}`;
      });
      const base64s = await Promise.all(base64Promises);
      return { success: true, data: base64s };
    } else if (runtime.imageModelProvider === "venice" /* VENICE */) {
      const response = await fetch(
        "https://api.venice.ai/api/v1/image/generate",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            prompt: data.prompt,
            cfg_scale: data.guidanceScale,
            negative_prompt: data.negativePrompt,
            width: data.width,
            height: data.height,
            steps: data.numIterations,
            safe_mode: data.safeMode,
            seed: data.seed,
            style_preset: data.stylePreset,
            hide_watermark: data.hideWatermark
          })
        }
      );
      const result = await response.json();
      if (!result.images || !Array.isArray(result.images)) {
        throw new Error("Invalid response format from Venice AI");
      }
      const base64s = result.images.map((base64String) => {
        if (!base64String) {
          throw new Error(
            "Empty base64 string in Venice AI response"
          );
        }
        return `data:image/png;base64,${base64String}`;
      });
      return { success: true, data: base64s };
    } else if (runtime.imageModelProvider === "nineteen_ai" /* NINETEEN_AI */) {
      const response = await fetch(
        "https://api.nineteen.ai/v1/text-to-image",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            prompt: data.prompt,
            negative_prompt: data.negativePrompt,
            width: data.width,
            height: data.height,
            steps: data.numIterations,
            cfg_scale: data.guidanceScale || 3
          })
        }
      );
      const result = await response.json();
      if (!result.images || !Array.isArray(result.images)) {
        throw new Error("Invalid response format from Nineteen AI");
      }
      const base64s = result.images.map((base64String) => {
        if (!base64String) {
          throw new Error(
            "Empty base64 string in Nineteen AI response"
          );
        }
        return `data:image/png;base64,${base64String}`;
      });
      return { success: true, data: base64s };
    } else if (runtime.imageModelProvider === "livepeer" /* LIVEPEER */) {
      if (!apiKey) {
        throw new Error("Livepeer Gateway is not defined");
      }
      try {
        const baseUrl = new URL(apiKey);
        if (!baseUrl.protocol.startsWith("http")) {
          throw new Error("Invalid Livepeer Gateway URL protocol");
        }
        const response = await fetch(
          `${baseUrl.toString()}text-to-image`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer eliza-app-img"
            },
            body: JSON.stringify({
              model_id: data.modelId || "ByteDance/SDXL-Lightning",
              prompt: data.prompt,
              width: data.width || 1024,
              height: data.height || 1024
            })
          }
        );
        const result = await response.json();
        if (!result.images?.length) {
          throw new Error("No images generated");
        }
        const base64Images = await Promise.all(
          result.images.map(async (image) => {
            console.log("imageUrl console log", image.url);
            let imageUrl;
            if (image.url.includes("http")) {
              imageUrl = image.url;
            } else {
              imageUrl = `${apiKey}${image.url}`;
            }
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
              throw new Error(
                `Failed to fetch image: ${imageResponse.statusText}`
              );
            }
            const blob = await imageResponse.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            return `data:image/jpeg;base64,${base64}`;
          })
        );
        return {
          success: true,
          data: base64Images
        };
      } catch (error) {
        console.error(error);
        return { success: false, error };
      }
    } else {
      let targetSize = `${data.width}x${data.height}`;
      if (targetSize !== "1024x1024" && targetSize !== "1792x1024" && targetSize !== "1024x1792") {
        targetSize = "1024x1024";
      }
      const openaiApiKey = runtime.getSetting("OPENAI_API_KEY");
      if (!openaiApiKey) {
        throw new Error("OPENAI_API_KEY is not set");
      }
      const openai = new OpenAI({
        apiKey: openaiApiKey
      });
      const response = await openai.images.generate({
        model,
        prompt: data.prompt,
        size: targetSize,
        n: data.count,
        response_format: "b64_json"
      });
      const base64s = response.data.map(
        (image) => `data:image/png;base64,${image.b64_json}`
      );
      return { success: true, data: base64s };
    }
  } catch (error) {
    console.error(error);
    return { success: false, error };
  }
};
var generateCaption = async (data, runtime) => {
  const { imageUrl } = data;
  const imageDescriptionService = runtime.getService(
    "image_description" /* IMAGE_DESCRIPTION */
  );
  if (!imageDescriptionService) {
    throw new Error("Image description service not found");
  }
  const resp = await imageDescriptionService.describeImage(imageUrl);
  return {
    title: resp.title.trim(),
    description: resp.description.trim()
  };
};
var generateObject = async ({
  runtime,
  context,
  modelClass,
  schema,
  schemaName,
  schemaDescription,
  stop,
  mode = "json"
}) => {
  if (!context) {
    const errorMessage = "generateObject context is empty";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  const provider = runtime.modelProvider;
  const modelSettings = getModelSettings(runtime.modelProvider, modelClass);
  const model = modelSettings.name;
  const temperature = modelSettings.temperature;
  const frequency_penalty = modelSettings.frequency_penalty;
  const presence_penalty = modelSettings.presence_penalty;
  const max_context_length = modelSettings.maxInputTokens;
  const max_response_length = modelSettings.maxOutputTokens;
  const experimental_telemetry = modelSettings.experimental_telemetry;
  const apiKey = runtime.token;
  try {
    context = await trimTokens(context, max_context_length, runtime);
    const modelOptions = {
      prompt: context,
      temperature,
      maxTokens: max_response_length,
      frequencyPenalty: frequency_penalty,
      presencePenalty: presence_penalty,
      stop: stop || modelSettings.stop,
      experimental_telemetry
    };
    const response = await handleProvider({
      provider,
      model,
      apiKey,
      schema,
      schemaName,
      schemaDescription,
      mode,
      modelOptions,
      runtime,
      context,
      modelClass
      // verifiableInference,
      // verifiableInferenceAdapter,
      // verifiableInferenceOptions,
    });
    return response;
  } catch (error) {
    console.error("Error in generateObject:", error);
    throw error;
  }
};
async function handleProvider(options2) {
  const {
    provider,
    runtime,
    context,
    modelClass
    //verifiableInference,
    //verifiableInferenceAdapter,
    //verifiableInferenceOptions,
  } = options2;
  switch (provider) {
    case "openai" /* OPENAI */:
    case "eternalai" /* ETERNALAI */:
    case "ali_bailian" /* ALI_BAILIAN */:
    case "volengine" /* VOLENGINE */:
    case "llama_cloud" /* LLAMACLOUD */:
    case "together" /* TOGETHER */:
    case "nanogpt" /* NANOGPT */:
    case "akash_chat_api" /* AKASH_CHAT_API */:
    case "lmstudio" /* LMSTUDIO */:
      return await handleOpenAI(options2);
    case "anthropic" /* ANTHROPIC */:
    case "claude_vertex" /* CLAUDE_VERTEX */:
      return await handleAnthropic(options2);
    case "grok" /* GROK */:
      return await handleGrok(options2);
    case "groq" /* GROQ */:
      return await handleGroq(options2);
    case "llama_local" /* LLAMALOCAL */:
      return await generateObjectDeprecated({
        runtime,
        context,
        modelClass
      });
    case "google" /* GOOGLE */:
      return await handleGoogle(options2);
    case "mistral" /* MISTRAL */:
      return await handleMistral(options2);
    case "redpill" /* REDPILL */:
      return await handleRedPill(options2);
    case "openrouter" /* OPENROUTER */:
      return await handleOpenRouter(options2);
    case "ollama" /* OLLAMA */:
      return await handleOllama(options2);
    case "deepseek" /* DEEPSEEK */:
      return await handleDeepSeek(options2);
    case "livepeer" /* LIVEPEER */:
      return await handleLivepeer(options2);
    case "secret_ai" /* SECRETAI */:
      return await handleSecretAi(options2);
    case "nearai" /* NEARAI */:
      return await handleNearAi(options2);
    case "bedrock" /* BEDROCK */:
      return await handleBedrock(options2);
    default: {
      const errorMessage = `Unsupported provider: ${provider}`;
      elizaLogger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
}
async function handleOpenAI({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  modelOptions,
  provider,
  runtime
}) {
  const endpoint = runtime.character.modelEndpointOverride || getEndpoint(provider);
  const baseURL = getCloudflareGatewayBaseURL(runtime, "openai") || endpoint;
  const openai = createOpenAI({
    apiKey,
    baseURL,
    fetch: runtime.fetch
  });
  return aiGenerateObject({
    model: openai.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleAnthropic({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode = "auto",
  modelOptions,
  runtime
}) {
  elizaLogger.debug("Handling Anthropic request with Cloudflare check");
  if (mode === "json") {
    elizaLogger.warn("Anthropic mode is set to json, changing to auto");
    mode = "auto";
  }
  const baseURL = getCloudflareGatewayBaseURL(runtime, "anthropic");
  elizaLogger.debug("Anthropic handleAnthropic baseURL:", { baseURL });
  const anthropic = createAnthropic({
    apiKey,
    baseURL,
    fetch: runtime.fetch
  });
  return await aiGenerateObject({
    model: anthropic.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleGrok({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  modelOptions,
  runtime
}) {
  const grok = createOpenAI({
    apiKey,
    baseURL: models.grok.endpoint,
    fetch: runtime.fetch
  });
  return aiGenerateObject({
    model: grok.languageModel(model, { parallelToolCalls: false }),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleGroq({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  modelOptions,
  runtime
}) {
  elizaLogger.debug("Handling Groq request with Cloudflare check");
  const baseURL = getCloudflareGatewayBaseURL(runtime, "groq");
  elizaLogger.debug("Groq handleGroq baseURL:", { baseURL });
  const groq = createGroq({
    apiKey,
    baseURL,
    fetch: runtime.fetch
  });
  return await aiGenerateObject({
    model: groq.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleGoogle({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  modelOptions,
  runtime
}) {
  const google = createGoogleGenerativeAI({
    apiKey,
    fetch: runtime.fetch
  });
  return aiGenerateObject({
    model: google(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleMistral({
  model,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions,
  runtime
}) {
  const mistral = createMistral({ fetch: runtime.fetch });
  return aiGenerateObject({
    model: mistral(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleRedPill({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  modelOptions,
  runtime
}) {
  const redPill = createOpenAI({
    apiKey,
    baseURL: models.redpill.endpoint,
    fetch: runtime.fetch
  });
  return aiGenerateObject({
    model: redPill.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleOpenRouter({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  modelOptions,
  runtime
}) {
  const openRouter = createOpenAI({
    apiKey,
    baseURL: models.openrouter.endpoint,
    fetch: runtime.fetch
  });
  return aiGenerateObject({
    model: openRouter.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleOllama({
  model,
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  modelOptions,
  provider,
  runtime
}) {
  const ollamaProvider = createOllama({
    baseURL: getEndpoint(provider) + "/api",
    fetch: runtime.fetch
  });
  const ollama = ollamaProvider(model);
  return aiGenerateObject({
    model: ollama,
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleDeepSeek({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions,
  runtime
}) {
  const openai = createOpenAI({
    apiKey,
    baseURL: models.deepseek.endpoint,
    fetch: runtime.fetch
  });
  return aiGenerateObject({
    model: openai.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleBedrock({
  model,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions,
  provider,
  runtime
}) {
  const bedrockClient = bedrock(model);
  return aiGenerateObject({
    model: bedrockClient,
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleLivepeer({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode,
  modelOptions,
  runtime
}) {
  console.log("Livepeer provider api key:", apiKey);
  if (!apiKey) {
    throw new Error(
      "Livepeer provider requires LIVEPEER_GATEWAY_URL to be configured"
    );
  }
  const livepeerClient = createOpenAI({
    apiKey,
    baseURL: apiKey,
    fetch: runtime.fetch
  });
  return aiGenerateObject({
    model: livepeerClient.languageModel(model),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleSecretAi({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  modelOptions,
  provider,
  runtime
}) {
  const secretAiProvider = createOllama({
    baseURL: getEndpoint(provider) + "/api",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    fetch: runtime.fetch
  });
  const secretAi = secretAiProvider(model);
  return aiGenerateObject({
    model: secretAi,
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function handleNearAi({
  model,
  apiKey,
  schema,
  schemaName,
  schemaDescription,
  mode = "json",
  modelOptions,
  runtime
}) {
  const nearai = createOpenAI({
    apiKey,
    baseURL: models.nearai.endpoint,
    fetch: runtime.fetch
  });
  const settings2 = schema ? { structuredOutputs: true } : void 0;
  return aiGenerateObject({
    model: nearai.languageModel(model, settings2),
    schema,
    schemaName,
    schemaDescription,
    mode,
    ...modelOptions
  });
}
async function generateTweetActions({
  runtime,
  context,
  modelClass
}) {
  let retryDelay = 1e3;
  while (true) {
    try {
      const response = await generateText({
        runtime,
        context,
        modelClass
      });
      elizaLogger.debug(
        "Received response from generateText for tweet actions:",
        response
      );
      const { actions } = parseActionResponseFromText(response.trim());
      if (actions) {
        elizaLogger.debug("Parsed tweet actions:", actions);
        return actions;
      } else {
        elizaLogger.debug("generateTweetActions no valid response");
      }
    } catch (error) {
      elizaLogger.error("Error in generateTweetActions:", error);
      if (error instanceof TypeError && error.message.includes("queueTextCompletion")) {
        elizaLogger.error(
          "TypeError: Cannot read properties of null (reading 'queueTextCompletion')"
        );
      }
    }
    elizaLogger.log(`Retrying in ${retryDelay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    retryDelay *= 2;
  }
}

// src/goals.ts
var getGoals = async ({
  runtime,
  roomId,
  userId,
  onlyInProgress = true,
  count = 5
}) => {
  return runtime.databaseAdapter.getGoals({
    agentId: runtime.agentId,
    roomId,
    userId,
    onlyInProgress,
    count
  });
};
var formatGoalsAsString = ({ goals }) => {
  const goalStrings = goals.map((goal) => {
    const header = `Goal: ${goal.name}
id: ${goal.id}`;
    const objectives = "Objectives:\n" + goal.objectives.map((objective) => {
      return `- ${objective.completed ? "[x]" : "[ ]"} ${objective.description} ${objective.completed ? " (DONE)" : " (IN PROGRESS)"}`;
    }).join("\n");
    return `${header}
${objectives}`;
  });
  return goalStrings.join("\n");
};
var updateGoal = async ({
  runtime,
  goal
}) => {
  return runtime.databaseAdapter.updateGoal(goal);
};
var createGoal = async ({
  runtime,
  goal
}) => {
  return runtime.databaseAdapter.createGoal(goal);
};

// src/memory.ts
var defaultMatchThreshold = 0.1;
var defaultMatchCount = 10;
var MemoryManager = class {
  /**
   * The AgentRuntime instance associated with this manager.
   */
  runtime;
  /**
   * The name of the database table this manager operates on.
   */
  tableName;
  /**
   * Constructs a new MemoryManager instance.
   * @param opts Options for the manager.
   * @param opts.tableName The name of the table this manager will operate on.
   * @param opts.runtime The AgentRuntime instance associated with this manager.
   */
  constructor(opts) {
    this.runtime = opts.runtime;
    this.tableName = opts.tableName;
  }
  /**
   * Adds an embedding vector to a memory object. If the memory already has an embedding, it is returned as is.
   * @param memory The memory object to add an embedding to.
   * @returns A Promise resolving to the memory object, potentially updated with an embedding vector.
   */
  /**
   * Adds an embedding vector to a memory object if one doesn't already exist.
   * The embedding is generated from the memory's text content using the runtime's
   * embedding model. If the memory has no text content, an error is thrown.
   *
   * @param memory The memory object to add an embedding to
   * @returns The memory object with an embedding vector added
   * @throws Error if the memory content is empty
   */
  async addEmbeddingToMemory(memory) {
    if (memory.embedding) {
      return memory;
    }
    const memoryText = memory.content.text;
    if (!memoryText) {
      throw new Error(
        "Cannot generate embedding: Memory content is empty"
      );
    }
    try {
      memory.embedding = await embed(this.runtime, memoryText);
    } catch (error) {
      logger_default.error("Failed to generate embedding:", error);
      memory.embedding = getEmbeddingZeroVector().slice();
    }
    return memory;
  }
  /**
   * Retrieves a list of memories by user IDs, with optional deduplication.
   * @param opts Options including user IDs, count, and uniqueness.
   * @param opts.roomId The room ID to retrieve memories for.
   * @param opts.count The number of memories to retrieve.
   * @param opts.unique Whether to retrieve unique memories only.
   * @returns A Promise resolving to an array of Memory objects.
   */
  async getMemories({
    roomId,
    count = 10,
    unique = true,
    start,
    end
  }) {
    return await this.runtime.databaseAdapter.getMemories({
      roomId,
      count,
      unique,
      tableName: this.tableName,
      agentId: this.runtime.agentId,
      start,
      end
    });
  }
  async getCachedEmbeddings(content) {
    return await this.runtime.databaseAdapter.getCachedEmbeddings({
      query_table_name: this.tableName,
      query_threshold: 2,
      query_input: content,
      query_field_name: "content",
      query_field_sub_name: "text",
      query_match_count: 10
    });
  }
  /**
   * Searches for memories similar to a given embedding vector.
   * @param embedding The embedding vector to search with.
   * @param opts Options including match threshold, count, user IDs, and uniqueness.
   * @param opts.match_threshold The similarity threshold for matching memories.
   * @param opts.count The maximum number of memories to retrieve.
   * @param opts.roomId The room ID to retrieve memories for.
   * @param opts.unique Whether to retrieve unique memories only.
   * @returns A Promise resolving to an array of Memory objects that match the embedding.
   */
  async searchMemoriesByEmbedding(embedding, opts) {
    const {
      match_threshold = defaultMatchThreshold,
      count = defaultMatchCount,
      roomId,
      unique
    } = opts;
    const result = await this.runtime.databaseAdapter.searchMemories({
      tableName: this.tableName,
      roomId,
      agentId: this.runtime.agentId,
      embedding,
      match_threshold,
      match_count: count,
      unique: !!unique
    });
    return result;
  }
  /**
   * Creates a new memory in the database, with an option to check for similarity before insertion.
   * @param memory The memory object to create.
   * @param unique Whether to check for similarity before insertion.
   * @returns A Promise that resolves when the operation completes.
   */
  async createMemory(memory, unique = false) {
    const existingMessage = await this.runtime.databaseAdapter.getMemoryById(memory.id);
    if (existingMessage) {
      logger_default.debug("Memory already exists, skipping");
      return;
    }
    logger_default.log("Creating Memory", memory.id, memory.content.text);
    await this.runtime.databaseAdapter.createMemory(
      memory,
      this.tableName,
      unique
    );
  }
  async getMemoriesByRoomIds(params) {
    return await this.runtime.databaseAdapter.getMemoriesByRoomIds({
      tableName: this.tableName,
      agentId: this.runtime.agentId,
      roomIds: params.roomIds,
      limit: params.limit
    });
  }
  async getMemoryById(id) {
    const result = await this.runtime.databaseAdapter.getMemoryById(id);
    if (result && result.agentId !== this.runtime.agentId) return null;
    return result;
  }
  /**
   * Removes a memory from the database by its ID.
   * @param memoryId The ID of the memory to remove.
   * @returns A Promise that resolves when the operation completes.
   */
  async removeMemory(memoryId) {
    await this.runtime.databaseAdapter.removeMemory(
      memoryId,
      this.tableName
    );
  }
  /**
   * Removes all memories associated with a set of user IDs.
   * @param roomId The room ID to remove memories for.
   * @returns A Promise that resolves when the operation completes.
   */
  async removeAllMemories(roomId) {
    await this.runtime.databaseAdapter.removeAllMemories(
      roomId,
      this.tableName
    );
  }
  /**
   * Counts the number of memories associated with a set of user IDs, with an option for uniqueness.
   * @param roomId The room ID to count memories for.
   * @param unique Whether to count unique memories only.
   * @returns A Promise resolving to the count of memories.
   */
  async countMemories(roomId, unique = true) {
    return await this.runtime.databaseAdapter.countMemories(
      roomId,
      unique,
      this.tableName
    );
  }
};

// src/messages.ts
async function getActorDetails({
  runtime,
  roomId
}) {
  const participantIds = await runtime.databaseAdapter.getParticipantsForRoom(roomId);
  const actors = await Promise.all(
    participantIds.map(async (userId) => {
      const account = await runtime.databaseAdapter.getAccountById(userId);
      if (account) {
        return {
          id: account.id,
          name: account.name,
          username: account.username,
          details: account.details
        };
      }
      return null;
    })
  );
  return actors.filter((actor) => actor !== null);
}
function formatActors({ actors }) {
  const actorStrings = actors.map((actor) => {
    const header = `${actor.name}${actor.details?.tagline ? ": " + actor.details?.tagline : ""}${actor.details?.summary ? "\n" + actor.details?.summary : ""}`;
    return header;
  });
  const finalActorStrings = actorStrings.join("\n");
  return finalActorStrings;
}
var formatMessages = ({
  messages,
  actors
}) => {
  const messageStrings = messages.reverse().filter((message) => message.userId).map((message) => {
    const messageContent = message.content.text;
    const messageAction = message.content.action;
    const formattedName = actors.find((actor) => actor.id === message.userId)?.name || "Unknown User";
    const attachments = message.content.attachments;
    const attachmentString = attachments && attachments.length > 0 ? ` (Attachments: ${attachments.map((media) => `[${media.id} - ${media.title} (${media.url})]`).join(", ")})` : "";
    const timestamp = formatTimestamp(message.createdAt);
    const shortId = message.userId.slice(-5);
    return `(${timestamp}) [${shortId}] ${formattedName}: ${messageContent}${attachmentString}${messageAction && messageAction !== "null" ? ` (${messageAction})` : ""}`;
  }).join("\n");
  return messageStrings;
};
var formatTimestamp = (messageDate) => {
  const now = /* @__PURE__ */ new Date();
  const diff = now.getTime() - messageDate;
  const absDiff = Math.abs(diff);
  const seconds = Math.floor(absDiff / 1e3);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (absDiff < 6e4) {
    return "just now";
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else {
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }
};

// src/posts.ts
var formatPosts = ({
  messages,
  actors,
  conversationHeader = true
}) => {
  const groupedMessages = {};
  messages.forEach((message) => {
    if (message.roomId) {
      if (!groupedMessages[message.roomId]) {
        groupedMessages[message.roomId] = [];
      }
      groupedMessages[message.roomId].push(message);
    }
  });
  Object.values(groupedMessages).forEach((roomMessages) => {
    roomMessages.sort((a, b) => a.createdAt - b.createdAt);
  });
  const sortedRooms = Object.entries(groupedMessages).sort(
    ([, messagesA], [, messagesB]) => messagesB[messagesB.length - 1].createdAt - messagesA[messagesA.length - 1].createdAt
  );
  const formattedPosts = sortedRooms.map(([roomId, roomMessages]) => {
    const messageStrings = roomMessages.filter((message) => message.userId).map((message) => {
      const actor = actors.find(
        (actor2) => actor2.id === message.userId
      );
      const userName = actor?.name || "Unknown User";
      const displayName = actor?.username || "unknown";
      return `Name: ${userName} (@${displayName})
ID: ${message.id}${message.content.inReplyTo ? `
In reply to: ${message.content.inReplyTo}` : ""}
Date: ${formatTimestamp(message.createdAt)}
Text:
${message.content.text}`;
    });
    const header = conversationHeader ? `Conversation: ${roomId.slice(-5)}
` : "";
    return `${header}${messageStrings.join("\n\n")}`;
  });
  return formattedPosts.join("\n\n");
};

// src/providers.ts
async function getProviders(runtime, message, state) {
  const providerResults = (await Promise.all(
    runtime.providers.map(async (provider) => {
      return await provider.get(runtime, message, state);
    })
  )).filter((result) => result != null && result !== "");
  return providerResults.join("\n");
}

// src/relationships.ts
async function createRelationship({
  runtime,
  userA,
  userB
}) {
  return runtime.databaseAdapter.createRelationship({
    userA,
    userB
  });
}
async function getRelationship({
  runtime,
  userA,
  userB
}) {
  return runtime.databaseAdapter.getRelationship({
    userA,
    userB
  });
}
async function getRelationships({
  runtime,
  userId
}) {
  return runtime.databaseAdapter.getRelationships({ userId });
}
async function formatRelationships({
  runtime,
  userId
}) {
  const relationships = await getRelationships({ runtime, userId });
  const formattedRelationships = relationships.map(
    (relationship) => {
      const { userA, userB } = relationship;
      if (userA === userId) {
        return userB;
      }
      return userA;
    }
  );
  return formattedRelationships;
}

// src/runtime.ts
import { readFile } from "fs/promises";
import { join as join2 } from "path";
import { names as names4, uniqueNamesGenerator as uniqueNamesGenerator4 } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";

// src/uuid.ts
import { sha1 } from "js-sha1";
import { z } from "zod";
var uuidSchema = z.string().uuid();
function validateUuid(value) {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : null;
}
function stringToUuid(target) {
  if (typeof target === "number") {
    target = target.toString();
  }
  if (typeof target !== "string") {
    throw TypeError("Value must be string");
  }
  const _uint8ToHex = (ubyte) => {
    const first = ubyte >> 4;
    const second = ubyte - (first << 4);
    const HEX_DIGITS = "0123456789abcdef".split("");
    return HEX_DIGITS[first] + HEX_DIGITS[second];
  };
  const _uint8ArrayToHex = (buf) => {
    let out = "";
    for (let i = 0; i < buf.length; i++) {
      out += _uint8ToHex(buf[i]);
    }
    return out;
  };
  const escapedStr = encodeURIComponent(target);
  const buffer = new Uint8Array(escapedStr.length);
  for (let i = 0; i < escapedStr.length; i++) {
    buffer[i] = escapedStr[i].charCodeAt(0);
  }
  const hash = sha1(buffer);
  const hashBuffer = new Uint8Array(hash.length / 2);
  for (let i = 0; i < hash.length; i += 2) {
    hashBuffer[i / 2] = Number.parseInt(hash.slice(i, i + 2), 16);
  }
  return _uint8ArrayToHex(hashBuffer.slice(0, 4)) + "-" + _uint8ArrayToHex(hashBuffer.slice(4, 6)) + "-" + _uint8ToHex(hashBuffer[6] & 15) + _uint8ToHex(hashBuffer[7]) + "-" + _uint8ToHex(hashBuffer[8] & 63 | 128) + _uint8ToHex(hashBuffer[9]) + "-" + _uint8ArrayToHex(hashBuffer.slice(10, 16));
}

// src/knowledge.ts
async function get(runtime, message) {
  if (!message?.content?.text) {
    logger_default.warn("Invalid message for knowledge query:", {
      message,
      content: message?.content,
      text: message?.content?.text
    });
    return [];
  }
  const processed = preprocess(message.content.text);
  logger_default.debug("Knowledge query:", {
    original: message.content.text,
    processed,
    length: processed?.length
  });
  if (!processed || processed.trim().length === 0) {
    logger_default.warn("Empty processed text for knowledge query");
    return [];
  }
  const embedding = await embed(runtime, processed);
  const fragments = await runtime.knowledgeManager.searchMemoriesByEmbedding(
    embedding,
    {
      roomId: message.agentId,
      count: 5,
      match_threshold: 0.1
    }
  );
  const uniqueSources = [
    ...new Set(
      fragments.map((memory) => {
        logger_default.log(
          `Matched fragment: ${memory.content.text} with similarity: ${memory.similarity}`
        );
        return memory.content.source;
      })
    )
  ];
  const knowledgeDocuments = await Promise.all(
    uniqueSources.map(
      (source) => runtime.documentsManager.getMemoryById(source)
    )
  );
  return knowledgeDocuments.filter((memory) => memory !== null).map((memory) => ({ id: memory.id, content: memory.content }));
}
async function set(runtime, item, chunkSize = 512, bleed = 20) {
  await runtime.documentsManager.createMemory({
    id: item.id,
    agentId: runtime.agentId,
    roomId: runtime.agentId,
    userId: runtime.agentId,
    createdAt: Date.now(),
    content: item.content,
    embedding: getEmbeddingZeroVector()
  });
  const preprocessed = preprocess(item.content.text);
  if (preprocessed.length <= chunkSize) {
    const embedding = await embed(runtime, preprocessed);
    await runtime.knowledgeManager.createMemory({
      id: stringToUuid(item.id + preprocessed),
      roomId: runtime.agentId,
      agentId: runtime.agentId,
      userId: runtime.agentId,
      createdAt: Date.now(),
      content: {
        source: item.id,
        text: preprocessed
      },
      embedding
    });
    return;
  }
  const fragments = await splitChunks(preprocessed, chunkSize, bleed);
  for (const fragment of fragments) {
    const embedding = await embed(runtime, fragment);
    await runtime.knowledgeManager.createMemory({
      // We namespace the knowledge base uuid to avoid id
      // collision with the document above.
      id: stringToUuid(item.id + fragment),
      roomId: runtime.agentId,
      agentId: runtime.agentId,
      userId: runtime.agentId,
      createdAt: Date.now(),
      content: {
        source: item.id,
        text: fragment
      },
      embedding
    });
  }
}
function preprocess(content) {
  logger_default.debug("Preprocessing text:", {
    input: content,
    length: content?.length
  });
  if (!content || typeof content !== "string") {
    logger_default.warn("Invalid input for preprocessing");
    return "";
  }
  return content.replace(/```[\s\S]*?```/g, "").replace(/`.*?`/g, "").replace(/#{1,6}\s*(.*)/g, "$1").replace(/!\[(.*?)\]\(.*?\)/g, "$1").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/(https?:\/\/)?(www\.)?([^\s]+\.[^\s]+)/g, "$3").replace(/<@[!&]?\d+>/g, "").replace(/<[^>]*>/g, "").replace(/^\s*[-*_]{3,}\s*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "").replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").replace(/[^a-zA-Z0-9\s\-_./:?=&]/g, "").trim().toLowerCase();
}
var knowledge_default = {
  get,
  set,
  preprocess
};

// src/ragknowledge.ts
import { existsSync } from "fs";
import { join } from "path";
var RAGKnowledgeManager = class {
  /**
   * The AgentRuntime instance associated with this manager.
   */
  runtime;
  /**
   * The name of the database table this manager operates on.
   */
  tableName;
  /**
   * The root directory where RAG knowledge files are located (internal)
   */
  knowledgeRoot;
  /**
   * Constructs a new KnowledgeManager instance.
   * @param opts Options for the manager.
   * @param opts.tableName The name of the table this manager will operate on.
   * @param opts.runtime The AgentRuntime instance associated with this manager.
   */
  constructor(opts) {
    this.runtime = opts.runtime;
    this.tableName = opts.tableName;
    this.knowledgeRoot = opts.knowledgeRoot;
  }
  defaultRAGMatchThreshold = 0.85;
  defaultRAGMatchCount = 8;
  /**
   * Common English stop words to filter out from query analysis
   */
  stopWords = /* @__PURE__ */ new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "does",
    "for",
    "from",
    "had",
    "has",
    "have",
    "he",
    "her",
    "his",
    "how",
    "hey",
    "i",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "will",
    "with",
    "would",
    "there",
    "their",
    "they",
    "your",
    "you"
  ]);
  /**
   * Filters out stop words and returns meaningful terms
   */
  getQueryTerms(query) {
    return query.toLowerCase().split(" ").filter((term) => term.length > 2).filter((term) => !this.stopWords.has(term));
  }
  /**
   * Preprocesses text content for better RAG performance.
   * @param content The text content to preprocess.
   * @returns The preprocessed text.
   */
  preprocess(content) {
    if (!content || typeof content !== "string") {
      logger_default.warn("Invalid input for preprocessing");
      return "";
    }
    return content.replace(/```[\s\S]*?```/g, "").replace(/`.*?`/g, "").replace(/#{1,6}\s*(.*)/g, "$1").replace(/!\[(.*?)\]\(.*?\)/g, "$1").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/(https?:\/\/)?(www\.)?([^\s]+\.[^\s]+)/g, "$3").replace(/<@[!&]?\d+>/g, "").replace(/<[^>]*>/g, "").replace(/^\s*[-*_]{3,}\s*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "").replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").trim().toLowerCase();
  }
  hasProximityMatch(text, terms) {
    if (!text || !terms.length) {
      return false;
    }
    const words = text.toLowerCase().split(" ").filter((w) => w.length > 0);
    const allPositions = terms.flatMap(
      (term) => words.reduce((positions, word, idx) => {
        if (word.includes(term)) positions.push(idx);
        return positions;
      }, [])
    ).sort((a, b) => a - b);
    if (allPositions.length < 2) return false;
    for (let i = 0; i < allPositions.length - 1; i++) {
      if (Math.abs(allPositions[i] - allPositions[i + 1]) <= 5) {
        logger_default.debug("[Proximity Match]", {
          terms,
          positions: allPositions,
          matchFound: `${allPositions[i]} - ${allPositions[i + 1]}`
        });
        return true;
      }
    }
    return false;
  }
  async getKnowledge(params) {
    const agentId = params.agentId || this.runtime.agentId;
    if (params.id) {
      const directResults = await this.runtime.databaseAdapter.getKnowledge({
        id: params.id,
        agentId
      });
      if (directResults.length > 0) {
        return directResults;
      }
    }
    if (params.query) {
      try {
        const processedQuery = this.preprocess(params.query);
        let searchText = processedQuery;
        if (params.conversationContext) {
          const relevantContext = this.preprocess(
            params.conversationContext
          );
          searchText = `${relevantContext} ${processedQuery}`;
        }
        const embeddingArray = await embed(this.runtime, searchText);
        const embedding = new Float32Array(embeddingArray);
        const results = await this.runtime.databaseAdapter.searchKnowledge({
          agentId: this.runtime.agentId,
          embedding,
          match_threshold: this.defaultRAGMatchThreshold,
          match_count: (params.limit || this.defaultRAGMatchCount) * 2,
          searchText: processedQuery
        });
        const rerankedResults = results.map((result) => {
          let score = result.similarity;
          const queryTerms = this.getQueryTerms(processedQuery);
          const matchingTerms = queryTerms.filter(
            (term) => result.content.text.toLowerCase().includes(term)
          );
          if (matchingTerms.length > 0) {
            score *= 1 + matchingTerms.length / queryTerms.length * 2;
            if (this.hasProximityMatch(
              result.content.text,
              matchingTerms
            )) {
              score *= 1.5;
            }
          } else {
            if (!params.conversationContext) {
              score *= 0.3;
            }
          }
          return {
            ...result,
            score,
            matchedTerms: matchingTerms
            // Add for debugging
          };
        }).sort((a, b) => b.score - a.score);
        return rerankedResults.filter(
          (result) => result.score >= this.defaultRAGMatchThreshold
        ).slice(0, params.limit || this.defaultRAGMatchCount);
      } catch (error) {
        console.log(`[RAG Search Error] ${error}`);
        return [];
      }
    }
    return [];
  }
  async createKnowledge(item) {
    if (!item.content.text) {
      logger_default.warn("Empty content in knowledge item");
      return;
    }
    try {
      const processedContent = this.preprocess(item.content.text);
      const mainEmbeddingArray = await embed(
        this.runtime,
        processedContent
      );
      const mainEmbedding = new Float32Array(mainEmbeddingArray);
      await this.runtime.databaseAdapter.createKnowledge({
        id: item.id,
        agentId: this.runtime.agentId,
        content: {
          text: item.content.text,
          metadata: {
            ...item.content.metadata,
            isMain: true
          }
        },
        embedding: mainEmbedding,
        createdAt: Date.now()
      });
      const chunks = await splitChunks(processedContent, 512, 20);
      for (const [index, chunk] of chunks.entries()) {
        const chunkEmbeddingArray = await embed(this.runtime, chunk);
        const chunkEmbedding = new Float32Array(chunkEmbeddingArray);
        const chunkId = `${item.id}-chunk-${index}`;
        await this.runtime.databaseAdapter.createKnowledge({
          id: chunkId,
          agentId: this.runtime.agentId,
          content: {
            text: chunk,
            metadata: {
              ...item.content.metadata,
              isChunk: true,
              originalId: item.id,
              chunkIndex: index
            }
          },
          embedding: chunkEmbedding,
          createdAt: Date.now()
        });
      }
    } catch (error) {
      logger_default.error(`Error processing knowledge ${item.id}:`, error);
      throw error;
    }
  }
  async searchKnowledge(params) {
    const {
      match_threshold = this.defaultRAGMatchThreshold,
      match_count = this.defaultRAGMatchCount,
      embedding,
      searchText
    } = params;
    const float32Embedding = Array.isArray(embedding) ? new Float32Array(embedding) : embedding;
    return await this.runtime.databaseAdapter.searchKnowledge({
      agentId: params.agentId || this.runtime.agentId,
      embedding: float32Embedding,
      match_threshold,
      match_count,
      searchText
    });
  }
  async removeKnowledge(id) {
    await this.runtime.databaseAdapter.removeKnowledge(id);
  }
  async clearKnowledge(shared) {
    await this.runtime.databaseAdapter.clearKnowledge(
      this.runtime.agentId,
      shared ? shared : false
    );
  }
  /**
   * Lists all knowledge entries for an agent without semantic search or reranking.
   * Used primarily for administrative tasks like cleanup.
   *
   * @param agentId The agent ID to fetch knowledge entries for
   * @returns Array of RAGKnowledgeItem entries
   */
  async listAllKnowledge(agentId) {
    logger_default.debug(
      `[Knowledge List] Fetching all entries for agent: ${agentId}`
    );
    try {
      const results = await this.runtime.databaseAdapter.getKnowledge({
        agentId
      });
      logger_default.debug(
        `[Knowledge List] Found ${results.length} entries`
      );
      return results;
    } catch (error) {
      logger_default.error(
        "[Knowledge List] Error fetching knowledge entries:",
        error
      );
      throw error;
    }
  }
  async cleanupDeletedKnowledgeFiles() {
    try {
      logger_default.debug(
        "[Cleanup] Starting knowledge cleanup process, agent: ",
        this.runtime.agentId
      );
      logger_default.debug(
        `[Cleanup] Knowledge root path: ${this.knowledgeRoot}`
      );
      const existingKnowledge = await this.listAllKnowledge(
        this.runtime.agentId
      );
      const parentDocuments = existingKnowledge.filter(
        (item) => !item.id.includes("chunk") && item.content.metadata?.source
        // Must have a source path
      );
      logger_default.debug(
        `[Cleanup] Found ${parentDocuments.length} parent documents to check`
      );
      for (const item of parentDocuments) {
        const relativePath = item.content.metadata?.source;
        const filePath = join(this.knowledgeRoot, relativePath);
        logger_default.debug(
          `[Cleanup] Checking joined file path: ${filePath}`
        );
        if (!existsSync(filePath)) {
          logger_default.warn(
            `[Cleanup] File not found, starting removal process: ${filePath}`
          );
          const idToRemove = item.id;
          logger_default.debug(
            `[Cleanup] Using ID for removal: ${idToRemove}`
          );
          try {
            await this.removeKnowledge(idToRemove);
            logger_default.success(
              `[Cleanup] Successfully removed knowledge for file: ${filePath}`
            );
          } catch (deleteError) {
            logger_default.error(
              `[Cleanup] Error during deletion process for ${filePath}:`,
              deleteError instanceof Error ? {
                message: deleteError.message,
                stack: deleteError.stack,
                name: deleteError.name
              } : deleteError
            );
          }
        }
      }
      logger_default.debug("[Cleanup] Finished knowledge cleanup process");
    } catch (error) {
      logger_default.error(
        "[Cleanup] Error cleaning up deleted knowledge files:",
        error
      );
    }
  }
  generateScopedId(path6, isShared) {
    const scope = isShared ? "shared" /* SHARED */ : "private" /* PRIVATE */;
    const scopedPath = `${scope}-${path6}`;
    return stringToUuid(scopedPath);
  }
  async processFile(file) {
    const timeMarker = (label) => {
      const time = (Date.now() - startTime) / 1e3;
      logger_default.info(`[Timing] ${label}: ${time.toFixed(2)}s`);
    };
    const startTime = Date.now();
    const content = file.content;
    try {
      const fileSizeKB = new TextEncoder().encode(content).length / 1024;
      logger_default.info(
        `[File Progress] Starting ${file.path} (${fileSizeKB.toFixed(2)} KB)`
      );
      const scopedId = this.generateScopedId(
        file.path,
        file.isShared || false
      );
      const processedContent = this.preprocess(content);
      timeMarker("Preprocessing");
      const mainEmbeddingArray = await embed(
        this.runtime,
        processedContent
      );
      const mainEmbedding = new Float32Array(mainEmbeddingArray);
      timeMarker("Main embedding");
      await this.runtime.databaseAdapter.createKnowledge({
        id: scopedId,
        agentId: this.runtime.agentId,
        content: {
          text: content,
          metadata: {
            source: file.path,
            type: file.type,
            isShared: file.isShared || false
          }
        },
        embedding: mainEmbedding,
        createdAt: Date.now()
      });
      timeMarker("Main document storage");
      const chunks = await splitChunks(processedContent, 512, 20);
      const totalChunks = chunks.length;
      logger_default.info(`Generated ${totalChunks} chunks`);
      timeMarker("Chunk generation");
      const BATCH_SIZE = 10;
      let processedChunks = 0;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchStart = Date.now();
        const batch = chunks.slice(
          i,
          Math.min(i + BATCH_SIZE, chunks.length)
        );
        const embeddings = await Promise.all(
          batch.map((chunk) => embed(this.runtime, chunk))
        );
        await Promise.all(
          embeddings.map(async (embeddingArray, index) => {
            const chunkId = `${scopedId}-chunk-${i + index}`;
            const chunkEmbedding = new Float32Array(embeddingArray);
            await this.runtime.databaseAdapter.createKnowledge({
              id: chunkId,
              agentId: this.runtime.agentId,
              content: {
                text: batch[index],
                metadata: {
                  source: file.path,
                  type: file.type,
                  isShared: file.isShared || false,
                  isChunk: true,
                  originalId: scopedId,
                  chunkIndex: i + index,
                  originalPath: file.path
                }
              },
              embedding: chunkEmbedding,
              createdAt: Date.now()
            });
          })
        );
        processedChunks += batch.length;
        const batchTime = (Date.now() - batchStart) / 1e3;
        logger_default.info(
          `[Batch Progress] ${file.path}: Processed ${processedChunks}/${totalChunks} chunks (${batchTime.toFixed(2)}s for batch)`
        );
      }
      const totalTime = (Date.now() - startTime) / 1e3;
      logger_default.info(
        `[Complete] Processed ${file.path} in ${totalTime.toFixed(2)}s`
      );
    } catch (error) {
      if (file.isShared && error?.code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
        logger_default.info(
          `Shared knowledge ${file.path} already exists in database, skipping creation`
        );
        return;
      }
      logger_default.error(`Error processing file ${file.path}:`, error);
      throw error;
    }
  }
};

// src/runtime.ts
import { glob } from "glob";
import { existsSync as existsSync2 } from "fs";
function isDirectoryItem(item) {
  return typeof item === "object" && item !== null && "directory" in item && typeof item.directory === "string";
}
var AgentRuntime = class {
  /**
   * Default count for recent messages to be kept in memory.
   * @private
   */
  #conversationLength = 32;
  /**
   * The ID of the agent
   */
  agentId;
  /**
   * The base URL of the server where the agent's requests are processed.
   */
  serverUrl = "http://localhost:7998";
  /**
   * The database adapter used for interacting with the database.
   */
  databaseAdapter;
  /**
   * Authentication token used for securing requests.
   */
  token;
  /**
   * Custom actions that the agent can perform.
   */
  actions = [];
  /**
   * Evaluators used to assess and guide the agent's responses.
   */
  evaluators = [];
  /**
   * Context providers used to provide context for message generation.
   */
  providers = [];
  /**
   * Database adapters used to interact with the database.
   */
  adapters = [];
  plugins = [];
  /**
   * The model to use for generateText.
   */
  modelProvider;
  /**
   * The model to use for generateImage.
   */
  imageModelProvider;
  /**
   * The model to use for describing images.
   */
  imageVisionModelProvider;
  /**
   * Fetch function to use
   * Some environments may not have access to the global fetch function and need a custom fetch override.
   */
  fetch = fetch;
  /**
   * The character to use for the agent
   */
  character;
  /**
   * Store messages that are sent and received by the agent.
   */
  messageManager;
  /**
   * Store and recall descriptions of users based on conversations.
   */
  descriptionManager;
  /**
   * Manage the creation and recall of static information (documents, historical game lore, etc)
   */
  loreManager;
  /**
   * Hold large documents that can be referenced
   */
  documentsManager;
  /**
   * Searchable document fragments
   */
  knowledgeManager;
  ragKnowledgeManager;
  knowledgeRoot;
  services = /* @__PURE__ */ new Map();
  memoryManagers = /* @__PURE__ */ new Map();
  cacheManager;
  clients = [];
  // verifiableInferenceAdapter?: IVerifiableInferenceAdapter;
  registerMemoryManager(manager) {
    if (!manager.tableName) {
      throw new Error("Memory manager must have a tableName");
    }
    if (this.memoryManagers.has(manager.tableName)) {
      elizaLogger.warn(
        `Memory manager ${manager.tableName} is already registered. Skipping registration.`
      );
      return;
    }
    this.memoryManagers.set(manager.tableName, manager);
  }
  getMemoryManager(tableName) {
    return this.memoryManagers.get(tableName) || null;
  }
  getService(service) {
    const serviceInstance = this.services.get(service);
    if (!serviceInstance) {
      elizaLogger.error(`Service ${service} not found`);
      return null;
    }
    return serviceInstance;
  }
  async registerService(service) {
    const serviceType = service.serviceType;
    elizaLogger.log(`${this.character.name}(${this.agentId}) - Registering service:`, serviceType);
    if (this.services.has(serviceType)) {
      elizaLogger.warn(
        `${this.character.name}(${this.agentId}) - Service ${serviceType} is already registered. Skipping registration.`
      );
      return;
    }
    this.services.set(serviceType, service);
    elizaLogger.success(`${this.character.name}(${this.agentId}) - Service ${serviceType} registered successfully`);
  }
  /**
   * Creates an instance of AgentRuntime.
   * @param opts - The options for configuring the AgentRuntime.
   * @param opts.conversationLength - The number of messages to hold in the recent message cache.
   * @param opts.token - The JWT token, can be a JWT token if outside worker, or an OpenAI token if inside worker.
   * @param opts.serverUrl - The URL of the worker.
   * @param opts.actions - Optional custom actions.
   * @param opts.evaluators - Optional custom evaluators.
   * @param opts.services - Optional custom services.
   * @param opts.memoryManagers - Optional custom memory managers.
   * @param opts.providers - Optional context providers.
   * @param opts.model - The model to use for generateText.
   * @param opts.embeddingModel - The model to use for embedding.
   * @param opts.agentId - Optional ID of the agent.
   * @param opts.databaseAdapter - The database adapter used for interacting with the database.
   * @param opts.fetch - Custom fetch function to use for making requests.
   */
  constructor(opts) {
    this.agentId = opts.character?.id ?? opts?.agentId ?? stringToUuid(opts.character?.name ?? uuidv4());
    this.character = opts.character;
    if (!this.character) {
      throw new Error("Character input is required");
    }
    elizaLogger.info(`${this.character.name}(${this.agentId}) - Initializing AgentRuntime with options:`, {
      character: opts.character?.name,
      modelProvider: opts.modelProvider,
      characterModelProvider: opts.character?.modelProvider
    });
    elizaLogger.debug(
      `[AgentRuntime] Process working directory: ${process.cwd()}`
    );
    this.knowledgeRoot = join2(
      process.cwd(),
      "..",
      "characters",
      "knowledge"
    );
    elizaLogger.debug(
      `[AgentRuntime] Process knowledgeRoot: ${this.knowledgeRoot}`
    );
    this.#conversationLength = opts.conversationLength ?? this.#conversationLength;
    this.databaseAdapter = opts.databaseAdapter;
    elizaLogger.success(`Agent ID: ${this.agentId}`);
    this.fetch = opts.fetch ?? this.fetch;
    this.cacheManager = opts.cacheManager;
    this.messageManager = new MemoryManager({
      runtime: this,
      tableName: "messages"
    });
    this.descriptionManager = new MemoryManager({
      runtime: this,
      tableName: "descriptions"
    });
    this.loreManager = new MemoryManager({
      runtime: this,
      tableName: "lore"
    });
    this.documentsManager = new MemoryManager({
      runtime: this,
      tableName: "documents"
    });
    this.knowledgeManager = new MemoryManager({
      runtime: this,
      tableName: "fragments"
    });
    this.ragKnowledgeManager = new RAGKnowledgeManager({
      runtime: this,
      tableName: "knowledge",
      knowledgeRoot: this.knowledgeRoot
    });
    (opts.managers ?? []).forEach((manager) => {
      this.registerMemoryManager(manager);
    });
    (opts.services ?? []).forEach((service) => {
      this.registerService(service);
    });
    this.serverUrl = opts.serverUrl ?? this.serverUrl;
    elizaLogger.info(`${this.character.name}(${this.agentId}) - Setting Model Provider:`, {
      characterModelProvider: this.character.modelProvider,
      optsModelProvider: opts.modelProvider,
      currentModelProvider: this.modelProvider,
      finalSelection: this.character.modelProvider ?? opts.modelProvider ?? this.modelProvider
    });
    this.modelProvider = this.character.modelProvider ?? opts.modelProvider ?? this.modelProvider;
    this.imageModelProvider = this.character.imageModelProvider ?? this.modelProvider;
    this.imageVisionModelProvider = this.character.imageVisionModelProvider ?? this.modelProvider;
    elizaLogger.info(
      `${this.character.name}(${this.agentId}) - Selected model provider:`,
      this.modelProvider
    );
    elizaLogger.info(
      `${this.character.name}(${this.agentId}) - Selected image model provider:`,
      this.imageModelProvider
    );
    elizaLogger.info(
      `${this.character.name}(${this.agentId}) - Selected image vision model provider:`,
      this.imageVisionModelProvider
    );
    if (!Object.values(ModelProviderName).includes(this.modelProvider)) {
      elizaLogger.error("Invalid model provider:", this.modelProvider);
      elizaLogger.error(
        "Available providers:",
        Object.values(ModelProviderName)
      );
      throw new Error(`Invalid model provider: ${this.modelProvider}`);
    }
    if (!this.serverUrl) {
      elizaLogger.warn("No serverUrl provided, defaulting to localhost");
    }
    this.token = opts.token;
    this.plugins = [
      ...opts.character?.plugins ?? [],
      ...opts.plugins ?? []
    ];
    this.plugins.forEach((plugin) => {
      plugin.actions?.forEach((action) => {
        this.registerAction(action);
      });
      plugin.evaluators?.forEach((evaluator) => {
        this.registerEvaluator(evaluator);
      });
      plugin.services?.forEach((service) => {
        this.registerService(service);
      });
      plugin.providers?.forEach((provider) => {
        this.registerContextProvider(provider);
      });
      plugin.adapters?.forEach((adapter) => {
        this.registerAdapter(adapter);
      });
    });
    (opts.actions ?? []).forEach((action) => {
      this.registerAction(action);
    });
    (opts.providers ?? []).forEach((provider) => {
      this.registerContextProvider(provider);
    });
    (opts.evaluators ?? []).forEach((evaluator) => {
      this.registerEvaluator(evaluator);
    });
  }
  async initializeDatabase() {
    this.ensureRoomExists(this.agentId);
    this.ensureUserExists(
      this.agentId,
      this.character.username || this.character.name,
      this.character.name
    ).then(() => {
      this.ensureParticipantExists(this.agentId, this.agentId);
    });
  }
  async initialize() {
    this.initializeDatabase();
    for (const [serviceType, service] of this.services.entries()) {
      try {
        await service.initialize(this);
        this.services.set(serviceType, service);
        elizaLogger.success(
          `${this.character.name}(${this.agentId}) - Service ${serviceType} initialized successfully`
        );
      } catch (error) {
        elizaLogger.error(
          `${this.character.name}(${this.agentId}) - Failed to initialize service ${serviceType}:`,
          error
        );
        throw error;
      }
    }
    if (this.character && this.character.knowledge && this.character.knowledge.length > 0) {
      elizaLogger.info(
        `[RAG Check] RAG Knowledge enabled: ${this.character.settings.ragKnowledge ? true : false}`
      );
      elizaLogger.info(
        `[RAG Check] Knowledge items:`,
        this.character.knowledge
      );
      if (this.character.settings.ragKnowledge) {
        const [directoryKnowledge, pathKnowledge, stringKnowledge] = this.character.knowledge.reduce(
          (acc, item) => {
            if (typeof item === "object") {
              if (isDirectoryItem(item)) {
                elizaLogger.debug(
                  `[RAG Filter] Found directory item: ${JSON.stringify(item)}`
                );
                acc[0].push(item);
              } else if ("path" in item) {
                elizaLogger.debug(
                  `[RAG Filter] Found path item: ${JSON.stringify(item)}`
                );
                acc[1].push(item);
              }
            } else if (typeof item === "string") {
              elizaLogger.debug(
                `[RAG Filter] Found string item: ${item.slice(0, 100)}...`
              );
              acc[2].push(item);
            }
            return acc;
          },
          [[], [], []]
        );
        elizaLogger.info(
          `[RAG Summary] Found ${directoryKnowledge.length} directories, ${pathKnowledge.length} paths, and ${stringKnowledge.length} strings`
        );
        if (directoryKnowledge.length > 0) {
          elizaLogger.info(
            `[RAG Process] Processing directory knowledge sources:`
          );
          for (const dir of directoryKnowledge) {
            elizaLogger.info(
              `  - Directory: ${dir.directory} (shared: ${!!dir.shared})`
            );
            await this.processCharacterRAGDirectory(dir);
          }
        }
        if (pathKnowledge.length > 0) {
          elizaLogger.info(
            `[RAG Process] Processing individual file knowledge sources`
          );
          await this.processCharacterRAGKnowledge(pathKnowledge);
        }
        if (stringKnowledge.length > 0) {
          elizaLogger.info(
            `[RAG Process] Processing direct string knowledge`
          );
          await this.processCharacterRAGKnowledge(stringKnowledge);
        }
      } else {
        const stringKnowledge = this.character.knowledge.filter(
          (item) => typeof item === "string"
        );
        await this.processCharacterKnowledge(stringKnowledge);
      }
      elizaLogger.info(
        `[RAG Cleanup] Starting cleanup of deleted knowledge files`
      );
      await this.ragKnowledgeManager.cleanupDeletedKnowledgeFiles();
      elizaLogger.info(`[RAG Cleanup] Cleanup complete`);
    }
  }
  async stop() {
    elizaLogger.debug("runtime::stop - character", this.character.name);
    for (const c of this.clients) {
      elizaLogger.log(
        "runtime::stop - requesting",
        c,
        "client stop for",
        this.character.name
      );
      c.stop(this);
    }
  }
  /**
   * Processes character knowledge by creating document memories and fragment memories.
   * This function takes an array of knowledge items, creates a document memory for each item if it doesn't exist,
   * then chunks the content into fragments, embeds each fragment, and creates fragment memories.
   * @param knowledge An array of knowledge items containing id, path, and content.
   */
  async processCharacterKnowledge(items) {
    for (const item of items) {
      const knowledgeId = stringToUuid(item);
      const existingDocument = await this.documentsManager.getMemoryById(knowledgeId);
      if (existingDocument) {
        continue;
      }
      elizaLogger.info(
        "Processing knowledge for ",
        this.character.name,
        " - ",
        item.slice(0, 100)
      );
      await knowledge_default.set(this, {
        id: knowledgeId,
        content: {
          text: item
        }
      });
    }
  }
  /**
   * Processes character knowledge by creating document memories and fragment memories.
   * This function takes an array of knowledge items, creates a document knowledge for each item if it doesn't exist,
   * then chunks the content into fragments, embeds each fragment, and creates fragment knowledge.
   * An array of knowledge items or objects containing id, path, and content.
   */
  async processCharacterRAGKnowledge(items) {
    let hasError = false;
    for (const item of items) {
      if (!item) continue;
      try {
        let isShared = false;
        let contentItem = item;
        if (typeof item === "object" && "path" in item) {
          isShared = item.shared === true;
          contentItem = item.path;
        } else {
          contentItem = item;
        }
        const knowledgeId = this.ragKnowledgeManager.generateScopedId(
          contentItem,
          isShared
        );
        const fileExtension = contentItem.split(".").pop()?.toLowerCase();
        if (fileExtension && ["md", "txt", "pdf"].includes(fileExtension)) {
          try {
            const filePath = join2(this.knowledgeRoot, contentItem);
            elizaLogger.debug("[RAG Query]", {
              knowledgeId,
              agentId: this.agentId,
              relativePath: contentItem,
              fullPath: filePath,
              isShared,
              knowledgeRoot: this.knowledgeRoot
            });
            const existingKnowledge = await this.ragKnowledgeManager.getKnowledge({
              id: knowledgeId,
              agentId: this.agentId
              // Keep agentId as it's used in OR query
            });
            elizaLogger.debug("[RAG Query Result]", {
              relativePath: contentItem,
              fullPath: filePath,
              knowledgeId,
              isShared,
              exists: existingKnowledge.length > 0,
              knowledgeCount: existingKnowledge.length,
              firstResult: existingKnowledge[0] ? {
                id: existingKnowledge[0].id,
                agentId: existingKnowledge[0].agentId,
                contentLength: existingKnowledge[0].content.text.length
              } : null,
              results: existingKnowledge.map((k) => ({
                id: k.id,
                agentId: k.agentId,
                isBaseKnowledge: !k.id.includes("chunk")
              }))
            });
            const content = await readFile(
              filePath,
              "utf8"
            );
            if (!content) {
              hasError = true;
              continue;
            }
            if (existingKnowledge.length > 0) {
              const existingContent = existingKnowledge[0].content.text;
              elizaLogger.debug("[RAG Compare]", {
                path: contentItem,
                knowledgeId,
                isShared,
                existingContentLength: existingContent.length,
                newContentLength: content.length,
                contentSample: content.slice(0, 100),
                existingContentSample: existingContent.slice(
                  0,
                  100
                ),
                matches: existingContent === content
              });
              if (existingContent === content) {
                elizaLogger.info(
                  `${isShared ? "Shared knowledge" : "Knowledge"} ${contentItem} unchanged, skipping`
                );
                continue;
              }
              elizaLogger.info(
                `${isShared ? "Shared knowledge" : "Knowledge"} ${contentItem} changed, updating...`
              );
              await this.ragKnowledgeManager.removeKnowledge(
                knowledgeId
              );
              await this.ragKnowledgeManager.removeKnowledge(
                `${knowledgeId}-chunk-*`
              );
            }
            elizaLogger.info(
              `Processing ${fileExtension.toUpperCase()} file content for`,
              this.character.name,
              "-",
              contentItem
            );
            await this.ragKnowledgeManager.processFile({
              path: contentItem,
              content,
              type: fileExtension,
              isShared
            });
          } catch (error) {
            hasError = true;
            elizaLogger.error(
              `Failed to read knowledge file ${contentItem}. Error details:`,
              error?.message || error || "Unknown error"
            );
            continue;
          }
        } else {
          elizaLogger.info(
            "Processing direct knowledge for",
            this.character.name,
            "-",
            contentItem.slice(0, 100)
          );
          const existingKnowledge = await this.ragKnowledgeManager.getKnowledge({
            id: knowledgeId,
            agentId: this.agentId
          });
          if (existingKnowledge.length > 0) {
            elizaLogger.info(
              `Direct knowledge ${knowledgeId} already exists, skipping`
            );
            continue;
          }
          await this.ragKnowledgeManager.createKnowledge({
            id: knowledgeId,
            agentId: this.agentId,
            content: {
              text: contentItem,
              metadata: {
                type: "direct"
              }
            }
          });
        }
      } catch (error) {
        hasError = true;
        elizaLogger.error(
          `Error processing knowledge item ${item}:`,
          error?.message || error || "Unknown error"
        );
        continue;
      }
    }
    if (hasError) {
      elizaLogger.warn(
        "Some knowledge items failed to process, but continuing with available knowledge"
      );
    }
  }
  /**
   * Processes directory-based RAG knowledge by recursively loading and processing files.
   * @param dirConfig The directory configuration containing path and shared flag
   */
  async processCharacterRAGDirectory(dirConfig) {
    if (!dirConfig.directory) {
      elizaLogger.error("[RAG Directory] No directory specified");
      return;
    }
    const sanitizedDir = dirConfig.directory.replace(/\.\./g, "");
    const dirPath = join2(this.knowledgeRoot, sanitizedDir);
    try {
      const dirExists = existsSync2(dirPath);
      if (!dirExists) {
        elizaLogger.error(
          `[RAG Directory] Directory does not exist: ${sanitizedDir}`
        );
        return;
      }
      elizaLogger.debug(`[RAG Directory] Searching in: ${dirPath}`);
      const files = await glob("**/*.{md,txt,pdf}", {
        cwd: dirPath,
        nodir: true,
        absolute: false
      });
      if (files.length === 0) {
        elizaLogger.warn(
          `No matching files found in directory: ${dirConfig.directory}`
        );
        return;
      }
      elizaLogger.info(
        `[RAG Directory] Found ${files.length} files in ${dirConfig.directory}`
      );
      const BATCH_SIZE = 5;
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (file) => {
            try {
              const relativePath = join2(sanitizedDir, file);
              elizaLogger.debug(
                `[RAG Directory] Processing file ${i + 1}/${files.length}:`,
                {
                  file,
                  relativePath,
                  shared: dirConfig.shared
                }
              );
              await this.processCharacterRAGKnowledge([
                {
                  path: relativePath,
                  shared: dirConfig.shared
                }
              ]);
            } catch (error) {
              elizaLogger.error(
                `[RAG Directory] Failed to process file: ${file}`,
                error instanceof Error ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack
                } : error
              );
            }
          })
        );
        elizaLogger.debug(
          `[RAG Directory] Completed batch ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} files`
        );
      }
      elizaLogger.success(
        `[RAG Directory] Successfully processed directory: ${sanitizedDir}`
      );
    } catch (error) {
      elizaLogger.error(
        `[RAG Directory] Failed to process directory: ${sanitizedDir}`,
        error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      );
      throw error;
    }
  }
  getSetting(key) {
    if (this.character.settings?.secrets?.[key]) {
      return this.character.settings.secrets[key];
    }
    if (this.character.settings?.[key]) {
      return this.character.settings[key];
    }
    if (settings_default[key]) {
      return settings_default[key];
    }
    return null;
  }
  /**
   * Get the number of messages that are kept in the conversation buffer.
   * @returns The number of recent messages to be kept in memory.
   */
  getConversationLength() {
    return this.#conversationLength;
  }
  /**
   * Register an action for the agent to perform.
   * @param action The action to register.
   */
  registerAction(action) {
    elizaLogger.success(`${this.character.name}(${this.agentId}) - Registering action: ${action.name}`);
    this.actions.push(action);
  }
  /**
   * Register an evaluator to assess and guide the agent's responses.
   * @param evaluator The evaluator to register.
   */
  registerEvaluator(evaluator) {
    this.evaluators.push(evaluator);
  }
  /**
   * Register a context provider to provide context for message generation.
   * @param provider The context provider to register.
   */
  registerContextProvider(provider) {
    this.providers.push(provider);
  }
  /**
   * Register an adapter for the agent to use.
   * @param adapter The adapter to register.
   */
  registerAdapter(adapter) {
    this.adapters.push(adapter);
  }
  /**
   * Process the actions of a message.
   * @param message The message to process.
   * @param content The content of the message to process actions from.
   */
  async processActions(message, responses, state, callback) {
    for (const response of responses) {
      if (!response.content?.action) {
        elizaLogger.warn("No action found in the response content.");
        continue;
      }
      const normalizedAction = response.content.action.toLowerCase().replace("_", "");
      elizaLogger.success(`Normalized action: ${normalizedAction}`);
      let action = this.actions.find(
        (a) => a.name.toLowerCase().replace("_", "").includes(normalizedAction) || normalizedAction.includes(
          a.name.toLowerCase().replace("_", "")
        )
      );
      if (!action) {
        elizaLogger.info("Attempting to find action in similes.");
        for (const _action of this.actions) {
          const simileAction = _action.similes.find(
            (simile) => simile.toLowerCase().replace("_", "").includes(normalizedAction) || normalizedAction.includes(
              simile.toLowerCase().replace("_", "")
            )
          );
          if (simileAction) {
            action = _action;
            elizaLogger.success(
              `Action found in similes: ${action.name}`
            );
            break;
          }
        }
      }
      if (!action) {
        elizaLogger.error(
          "No action found for",
          response.content.action
        );
        continue;
      }
      if (!action.handler) {
        elizaLogger.error(`Action ${action.name} has no handler.`);
        continue;
      }
      try {
        elizaLogger.info(
          `Executing handler for action: ${action.name}`
        );
        await action.handler(this, message, state, {}, callback);
      } catch (error) {
        elizaLogger.error(error);
      }
    }
  }
  /**
   * Evaluate the message and state using the registered evaluators.
   * @param message The message to evaluate.
   * @param state The state of the agent.
   * @param didRespond Whether the agent responded to the message.~
   * @param callback The handler callback
   * @returns The results of the evaluation.
   */
  async evaluate(message, state, didRespond, callback) {
    const evaluatorPromises = this.evaluators.map(
      async (evaluator) => {
        elizaLogger.log("Evaluating", evaluator.name);
        if (!evaluator.handler) {
          return null;
        }
        if (!didRespond && !evaluator.alwaysRun) {
          return null;
        }
        const result2 = await evaluator.validate(this, message, state);
        if (result2) {
          return evaluator;
        }
        return null;
      }
    );
    const resolvedEvaluators = await Promise.all(evaluatorPromises);
    const evaluatorsData = resolvedEvaluators.filter(
      (evaluator) => evaluator !== null
    );
    if (!evaluatorsData || evaluatorsData.length === 0) {
      return [];
    }
    const context = composeContext({
      state: {
        ...state,
        evaluators: formatEvaluators(evaluatorsData),
        evaluatorNames: formatEvaluatorNames(evaluatorsData)
      },
      template: this.character.templates?.evaluationTemplate || evaluationTemplate
    });
    const result = await generateText({
      runtime: this,
      context,
      modelClass: "small" /* SMALL */
      // verifiableInferenceAdapter: this.verifiableInferenceAdapter,
    });
    const evaluators = parseJsonArrayFromText(
      result
    );
    for (const evaluator of this.evaluators) {
      if (!evaluators?.includes(evaluator.name)) continue;
      if (evaluator.handler)
        await evaluator.handler(this, message, state, {}, callback);
    }
    return evaluators;
  }
  /**
   * Ensure the existence of a participant in the room. If the participant does not exist, they are added to the room.
   * @param userId - The user ID to ensure the existence of.
   * @throws An error if the participant cannot be added.
   */
  async ensureParticipantExists(userId, roomId) {
    const participants = await this.databaseAdapter.getParticipantsForAccount(userId);
    if (participants?.length === 0) {
      await this.databaseAdapter.addParticipant(userId, roomId);
    }
  }
  /**
   * Ensure the existence of a user in the database. If the user does not exist, they are added to the database.
   * @param userId - The user ID to ensure the existence of.
   * @param userName - The user name to ensure the existence of.
   * @returns
   */
  async ensureUserExists(userId, userName, name, email, source) {
    const account = await this.databaseAdapter.getAccountById(userId);
    if (!account) {
      await this.databaseAdapter.createAccount({
        id: userId,
        name: name || this.character.name || "Unknown User",
        username: userName || this.character.username || "Unknown",
        // TODO: We might not need these account pieces
        email: email || this.character.email || userId,
        // When invoke ensureUserExists and saving account.details
        // Performing a complete JSON.stringify on character will cause a TypeError: Converting circular structure to JSON error in some more complex plugins.
        details: this.character ? Object.assign({}, this.character, {
          source,
          plugins: this.character?.plugins?.map((plugin) => plugin.name)
        }) : { summary: "" }
      });
      elizaLogger.success(`User ${userName} created successfully.`);
    }
  }
  async ensureParticipantInRoom(userId, roomId) {
    const participants = await this.databaseAdapter.getParticipantsForRoom(roomId);
    if (!participants.includes(userId)) {
      await this.databaseAdapter.addParticipant(userId, roomId);
      if (userId === this.agentId) {
        elizaLogger.log(
          `Agent ${this.character.name} linked to room ${roomId} successfully.`
        );
      } else {
        elizaLogger.log(
          `User ${userId} linked to room ${roomId} successfully.`
        );
      }
    }
  }
  async ensureConnection(userId, roomId, userName, userScreenName, source) {
    await Promise.all([
      this.ensureUserExists(
        this.agentId,
        this.character.username ?? "Agent",
        this.character.name ?? "Agent",
        source
      ),
      this.ensureUserExists(
        userId,
        userName ?? "User" + userId,
        userScreenName ?? "User" + userId,
        source
      ),
      this.ensureRoomExists(roomId)
    ]);
    await Promise.all([
      this.ensureParticipantInRoom(userId, roomId),
      this.ensureParticipantInRoom(this.agentId, roomId)
    ]);
  }
  /**
   * Ensure the existence of a room between the agent and a user. If no room exists, a new room is created and the user
   * and agent are added as participants. The room ID is returned.
   * @param userId - The user ID to create a room with.
   * @returns The room ID of the room between the agent and the user.
   * @throws An error if the room cannot be created.
   */
  async ensureRoomExists(roomId) {
    const room = await this.databaseAdapter.getRoom(roomId);
    if (!room) {
      await this.databaseAdapter.createRoom(roomId);
      elizaLogger.log(`Room ${roomId} created successfully.`);
    }
  }
  /**
   * Compose the state of the agent into an object that can be passed or used for response generation.
   * @param message The message to compose the state from.
   * @returns The state of the agent.
   */
  async composeState(message, additionalKeys = {}) {
    const { userId, roomId } = message;
    const conversationLength = this.getConversationLength();
    const [actorsData, recentMessagesData, goalsData] = await Promise.all([
      getActorDetails({ runtime: this, roomId }),
      this.messageManager.getMemories({
        roomId,
        count: conversationLength,
        unique: false
      }),
      getGoals({
        runtime: this,
        count: 10,
        onlyInProgress: false,
        roomId
      })
    ]);
    const goals = formatGoalsAsString({ goals: goalsData });
    const actors = formatActors({ actors: actorsData ?? [] });
    const recentMessages = formatMessages({
      messages: recentMessagesData,
      actors: actorsData
    });
    const recentPosts = formatPosts({
      messages: recentMessagesData,
      actors: actorsData,
      conversationHeader: false
    });
    const senderName = actorsData?.find(
      (actor) => actor.id === userId
    )?.name;
    const agentName = actorsData?.find((actor) => actor.id === this.agentId)?.name || this.character.name;
    let allAttachments = message.content.attachments || [];
    if (recentMessagesData && Array.isArray(recentMessagesData)) {
      const lastMessageWithAttachment = recentMessagesData.find(
        (msg) => msg.content.attachments && msg.content.attachments.length > 0
      );
      if (lastMessageWithAttachment) {
        const lastMessageTime = lastMessageWithAttachment?.createdAt ?? Date.now();
        const oneHourBeforeLastMessage = lastMessageTime - 60 * 60 * 1e3;
        allAttachments = recentMessagesData.reverse().flatMap((msg) => {
          const msgTime = msg.createdAt ?? Date.now();
          const isWithinTime = msgTime >= oneHourBeforeLastMessage;
          const attachments = msg.content.attachments || [];
          if (!isWithinTime) {
            attachments.forEach((attachment) => {
              attachment.text = "[Hidden]";
            });
          }
          return attachments;
        });
      }
    }
    const formattedAttachments = allAttachments.map(
      (attachment) => `ID: ${attachment.id}
Name: ${attachment.title}
URL: ${attachment.url}
Type: ${attachment.source}
Description: ${attachment.description}
Text: ${attachment.text}
  `
    ).join("\n");
    let lore = "";
    if (this.character.lore && this.character.lore.length > 0) {
      const shuffledLore = [...this.character.lore].sort(
        () => Math.random() - 0.5
      );
      const selectedLore = shuffledLore.slice(0, 10);
      lore = selectedLore.join("\n");
    }
    const formattedCharacterPostExamples = this.character.postExamples.sort(() => 0.5 - Math.random()).map((post) => {
      const messageString = `${post}`;
      return messageString;
    }).slice(0, 50).join("\n");
    const formattedCharacterMessageExamples = this.character.messageExamples.sort(() => 0.5 - Math.random()).slice(0, 5).map((example) => {
      const exampleNames = Array.from(
        { length: 5 },
        () => uniqueNamesGenerator4({ dictionaries: [names4] })
      );
      return example.map((message2) => {
        let messageString = `${message2.user}: ${message2.content.text}`;
        exampleNames.forEach((name, index) => {
          const placeholder = `{{user${index + 1}}}`;
          messageString = messageString.replaceAll(
            placeholder,
            name
          );
        });
        return messageString;
      }).join("\n");
    }).join("\n\n");
    const getRecentInteractions = async (userA, userB) => {
      const rooms = await this.databaseAdapter.getRoomsForParticipants([
        userA,
        userB
      ]);
      return this.messageManager.getMemoriesByRoomIds({
        // filter out the current room id from rooms
        roomIds: rooms.filter((room) => room !== roomId),
        limit: 20
      });
    };
    const recentInteractions = userId !== this.agentId ? await getRecentInteractions(userId, this.agentId) : [];
    const getRecentMessageInteractions = async (recentInteractionsData) => {
      const formattedInteractions = await Promise.all(
        recentInteractionsData.map(async (message2) => {
          const isSelf = message2.userId === this.agentId;
          let sender;
          if (isSelf) {
            sender = this.character.name;
          } else {
            const accountId = await this.databaseAdapter.getAccountById(
              message2.userId
            );
            sender = accountId?.username || "unknown";
          }
          return `${sender}: ${message2.content.text}`;
        })
      );
      return formattedInteractions.join("\n");
    };
    const formattedMessageInteractions = await getRecentMessageInteractions(recentInteractions);
    const getRecentPostInteractions = async (recentInteractionsData, actors2) => {
      const formattedInteractions = formatPosts({
        messages: recentInteractionsData,
        actors: actors2,
        conversationHeader: true
      });
      return formattedInteractions;
    };
    const formattedPostInteractions = await getRecentPostInteractions(
      recentInteractions,
      actorsData
    );
    let bio = this.character.bio || "";
    if (Array.isArray(bio)) {
      bio = bio.sort(() => 0.5 - Math.random()).slice(0, 3).join(" ");
    }
    let knowledgeData = [];
    let formattedKnowledge = "";
    if (this.character.settings?.ragKnowledge) {
      const recentContext = recentMessagesData.sort((a, b) => b.createdAt - a.createdAt).slice(0, 3).reverse().map((msg) => msg.content.text).join(" ");
      knowledgeData = await this.ragKnowledgeManager.getKnowledge({
        query: message.content.text,
        conversationContext: recentContext,
        limit: 8
      });
      formattedKnowledge = formatKnowledge(knowledgeData);
    } else {
      knowledgeData = await knowledge_default.get(this, message);
      formattedKnowledge = formatKnowledge(knowledgeData);
    }
    const initialState = {
      agentId: this.agentId,
      agentName,
      bio,
      lore,
      adjective: this.character.adjectives && this.character.adjectives.length > 0 ? this.character.adjectives[Math.floor(
        Math.random() * this.character.adjectives.length
      )] : "",
      knowledge: formattedKnowledge,
      knowledgeData,
      ragKnowledgeData: knowledgeData,
      // Recent interactions between the sender and receiver, formatted as messages
      recentMessageInteractions: formattedMessageInteractions,
      // Recent interactions between the sender and receiver, formatted as posts
      recentPostInteractions: formattedPostInteractions,
      // Raw memory[] array of interactions
      recentInteractionsData: recentInteractions,
      // randomly pick one topic
      topic: this.character.topics && this.character.topics.length > 0 ? this.character.topics[Math.floor(
        Math.random() * this.character.topics.length
      )] : null,
      topics: this.character.topics && this.character.topics.length > 0 ? `${this.character.name} is interested in ` + this.character.topics.sort(() => 0.5 - Math.random()).slice(0, 5).map((topic, index, array) => {
        if (index === array.length - 2) {
          return topic + " and ";
        }
        if (index === array.length - 1) {
          return topic;
        }
        return topic + ", ";
      }).join("") : "",
      characterPostExamples: formattedCharacterPostExamples && formattedCharacterPostExamples.replaceAll("\n", "").length > 0 ? addHeader(
        `# Example Posts for ${this.character.name}`,
        formattedCharacterPostExamples
      ) : "",
      characterMessageExamples: formattedCharacterMessageExamples && formattedCharacterMessageExamples.replaceAll("\n", "").length > 0 ? addHeader(
        `# Example Conversations for ${this.character.name}`,
        formattedCharacterMessageExamples
      ) : "",
      messageDirections: this.character?.style?.all?.length > 0 || this.character?.style?.chat.length > 0 ? addHeader(
        "# Message Directions for " + this.character.name,
        (() => {
          const all = this.character?.style?.all || [];
          const chat = this.character?.style?.chat || [];
          return [...all, ...chat].join("\n");
        })()
      ) : "",
      postDirections: this.character?.style?.all?.length > 0 || this.character?.style?.post.length > 0 ? addHeader(
        "# Post Directions for " + this.character.name,
        (() => {
          const all = this.character?.style?.all || [];
          const post = this.character?.style?.post || [];
          return [...all, ...post].join("\n");
        })()
      ) : "",
      //old logic left in for reference
      //food for thought. how could we dynamically decide what parts of the character to add to the prompt other than random? rag? prompt the llm to decide?
      /*
      postDirections:
          this.character?.style?.all?.length > 0 ||
          this.character?.style?.post.length > 0
              ? addHeader(
                      "# Post Directions for " + this.character.name,
                      (() => {
                          const all = this.character?.style?.all || [];
                          const post = this.character?.style?.post || [];
                          const shuffled = [...all, ...post].sort(
                              () => 0.5 - Math.random()
                          );
                          return shuffled
                              .slice(0, conversationLength / 2)
                              .join("\n");
                      })()
                  )
              : "",*/
      // Agent runtime stuff
      senderName,
      actors: actors && actors.length > 0 ? addHeader("# Actors", actors) : "",
      actorsData,
      roomId,
      goals: goals && goals.length > 0 ? addHeader(
        "# Goals\n{{agentName}} should prioritize accomplishing the objectives that are in progress.",
        goals
      ) : "",
      goalsData,
      recentMessages: recentMessages && recentMessages.length > 0 ? addHeader("# Conversation Messages", recentMessages) : "",
      recentPosts: recentPosts && recentPosts.length > 0 ? addHeader("# Posts in Thread", recentPosts) : "",
      recentMessagesData,
      attachments: formattedAttachments && formattedAttachments.length > 0 ? addHeader("# Attachments", formattedAttachments) : "",
      ...additionalKeys
    };
    const actionPromises = this.actions.map(async (action) => {
      const result = await action.validate(this, message, initialState);
      if (result) {
        return action;
      }
      return null;
    });
    const evaluatorPromises = this.evaluators.map(async (evaluator) => {
      const result = await evaluator.validate(
        this,
        message,
        initialState
      );
      if (result) {
        return evaluator;
      }
      return null;
    });
    const [resolvedEvaluators, resolvedActions, providers] = await Promise.all([
      Promise.all(evaluatorPromises),
      Promise.all(actionPromises),
      getProviders(this, message, initialState)
    ]);
    const evaluatorsData = resolvedEvaluators.filter(
      Boolean
    );
    const actionsData = resolvedActions.filter(Boolean);
    const actionState = {
      actionNames: "Possible response actions: " + formatActionNames(actionsData),
      actions: actionsData.length > 0 ? addHeader(
        "# Available Actions",
        formatActions(actionsData)
      ) : "",
      actionExamples: actionsData.length > 0 ? addHeader(
        "# Action Examples",
        composeActionExamples(actionsData, 10)
      ) : "",
      evaluatorsData,
      evaluators: evaluatorsData.length > 0 ? formatEvaluators(evaluatorsData) : "",
      evaluatorNames: evaluatorsData.length > 0 ? formatEvaluatorNames(evaluatorsData) : "",
      evaluatorExamples: evaluatorsData.length > 0 ? formatEvaluatorExamples(evaluatorsData) : "",
      providers: addHeader(
        `# Additional Information About ${this.character.name} and The World`,
        providers
      )
    };
    return { ...initialState, ...actionState };
  }
  async updateRecentMessageState(state) {
    const conversationLength = this.getConversationLength();
    const recentMessagesData = await this.messageManager.getMemories({
      roomId: state.roomId,
      count: conversationLength,
      unique: false
    });
    const recentMessages = formatMessages({
      actors: state.actorsData ?? [],
      messages: recentMessagesData.map((memory) => {
        const newMemory = { ...memory };
        delete newMemory.embedding;
        return newMemory;
      })
    });
    let allAttachments = [];
    if (recentMessagesData && Array.isArray(recentMessagesData)) {
      const lastMessageWithAttachment = recentMessagesData.find(
        (msg) => msg.content.attachments && msg.content.attachments.length > 0
      );
      if (lastMessageWithAttachment) {
        const lastMessageTime = lastMessageWithAttachment?.createdAt ?? Date.now();
        const oneHourBeforeLastMessage = lastMessageTime - 60 * 60 * 1e3;
        allAttachments = recentMessagesData.filter((msg) => {
          const msgTime = msg.createdAt ?? Date.now();
          return msgTime >= oneHourBeforeLastMessage;
        }).flatMap((msg) => msg.content.attachments || []);
      }
    }
    const formattedAttachments = allAttachments.map(
      (attachment) => `ID: ${attachment.id}
Name: ${attachment.title}
URL: ${attachment.url}
Type: ${attachment.source}
Description: ${attachment.description}
Text: ${attachment.text}
    `
    ).join("\n");
    return {
      ...state,
      recentMessages: addHeader(
        "# Conversation Messages",
        recentMessages
      ),
      recentMessagesData,
      attachments: formattedAttachments
    };
  }
};
var formatKnowledge = (knowledge) => {
  return knowledge.map((item) => {
    const text = item.content.text;
    const cleanedText = text.trim().replace(/\n{3,}/g, "\n\n");
    return cleanedText;
  }).join("\n\n");
};

// src/environment.ts
import { z as z2 } from "zod";
var envSchema = z2.object({
  // API Keys with specific formats
  OPENAI_API_KEY: z2.string().startsWith("sk-", "OpenAI API key must start with 'sk-'"),
  REDPILL_API_KEY: z2.string().min(1, "REDPILL API key is required"),
  GROK_API_KEY: z2.string().min(1, "GROK API key is required"),
  GROQ_API_KEY: z2.string().startsWith("gsk_", "GROQ API key must start with 'gsk_'"),
  OPENROUTER_API_KEY: z2.string().min(1, "OpenRouter API key is required"),
  GOOGLE_GENERATIVE_AI_API_KEY: z2.string().min(1, "Gemini API key is required"),
  ELEVENLABS_XI_API_KEY: z2.string().min(1, "ElevenLabs API key is required")
});
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path}: ${err.message}`).join("\n");
      throw new Error(`Environment validation failed:
${errorMessages}`);
    }
    throw error;
  }
}
var MessageExampleSchema = z2.object({
  user: z2.string(),
  content: z2.object({
    text: z2.string(),
    action: z2.string().optional(),
    source: z2.string().optional(),
    url: z2.string().optional(),
    inReplyTo: z2.string().uuid().optional(),
    attachments: z2.array(z2.any()).optional()
  }).and(z2.record(z2.string(), z2.unknown()))
  // For additional properties
});
var PluginSchema = z2.object({
  name: z2.string(),
  description: z2.string(),
  actions: z2.array(z2.any()).optional(),
  providers: z2.array(z2.any()).optional(),
  evaluators: z2.array(z2.any()).optional(),
  services: z2.array(z2.any()).optional(),
  clients: z2.array(z2.any()).optional()
});
var CharacterSchema = z2.object({
  id: z2.string().uuid().optional(),
  name: z2.string(),
  system: z2.string().optional(),
  modelProvider: z2.nativeEnum(ModelProviderName),
  modelEndpointOverride: z2.string().optional(),
  templates: z2.record(z2.string()).optional(),
  bio: z2.union([z2.string(), z2.array(z2.string())]),
  lore: z2.array(z2.string()),
  messageExamples: z2.array(z2.array(MessageExampleSchema)),
  postExamples: z2.array(z2.string()),
  topics: z2.array(z2.string()),
  adjectives: z2.array(z2.string()),
  knowledge: z2.array(
    z2.union([
      z2.string(),
      // Direct knowledge strings
      z2.object({
        // Individual file config
        path: z2.string(),
        shared: z2.boolean().optional()
      }),
      z2.object({
        // Directory config
        directory: z2.string(),
        shared: z2.boolean().optional()
      })
    ])
  ).optional(),
  plugins: z2.union([z2.array(z2.string()), z2.array(PluginSchema)]),
  settings: z2.object({
    secrets: z2.record(z2.string()).optional(),
    voice: z2.object({
      model: z2.string().optional(),
      url: z2.string().optional()
    }).optional(),
    model: z2.string().optional(),
    modelConfig: z2.object({
      maxInputTokens: z2.number().optional(),
      maxOutputTokens: z2.number().optional(),
      temperature: z2.number().optional(),
      frequency_penalty: z2.number().optional(),
      presence_penalty: z2.number().optional()
    }).optional(),
    embeddingModel: z2.string().optional()
  }).optional(),
  clientConfig: z2.object({
    discord: z2.object({
      shouldIgnoreBotMessages: z2.boolean().optional(),
      shouldIgnoreDirectMessages: z2.boolean().optional()
    }).optional(),
    telegram: z2.object({
      shouldIgnoreBotMessages: z2.boolean().optional(),
      shouldIgnoreDirectMessages: z2.boolean().optional()
    }).optional()
  }).optional(),
  style: z2.object({
    all: z2.array(z2.string()),
    chat: z2.array(z2.string()),
    post: z2.array(z2.string())
  }),
  twitterProfile: z2.object({
    username: z2.string(),
    screenName: z2.string(),
    bio: z2.string(),
    nicknames: z2.array(z2.string()).optional()
  }).optional(),
  nft: z2.object({
    prompt: z2.string().optional()
  }).optional(),
  extends: z2.array(z2.string()).optional()
});
function validateCharacterConfig(json) {
  try {
    return CharacterSchema.parse(json);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      const groupedErrors = error.errors.reduce(
        (acc, err) => {
          const path6 = err.path.join(".");
          if (!acc[path6]) {
            acc[path6] = [];
          }
          acc[path6].push(err.message);
          return acc;
        },
        {}
      );
      Object.entries(groupedErrors).forEach(([field, messages]) => {
        logger_default.error(
          `Validation errors in ${field}: ${messages.join(" - ")}`
        );
      });
      throw new Error(
        "Character configuration validation failed. Check logs for details."
      );
    }
    throw error;
  }
}

// src/cache.ts
import path5 from "path";
import fs3 from "fs/promises";
var MemoryCacheAdapter = class {
  data;
  constructor(initalData) {
    this.data = initalData ?? /* @__PURE__ */ new Map();
  }
  async get(key) {
    return this.data.get(key);
  }
  async set(key, value) {
    this.data.set(key, value);
  }
  async delete(key) {
    this.data.delete(key);
  }
};
var FsCacheAdapter = class {
  constructor(dataDir) {
    this.dataDir = dataDir;
  }
  async get(key) {
    try {
      return await fs3.readFile(path5.join(this.dataDir, key), "utf8");
    } catch {
      return void 0;
    }
  }
  async set(key, value) {
    try {
      const filePath = path5.join(this.dataDir, key);
      await fs3.mkdir(path5.dirname(filePath), { recursive: true });
      await fs3.writeFile(filePath, value, "utf8");
    } catch (error) {
      console.error(error);
    }
  }
  async delete(key) {
    try {
      const filePath = path5.join(this.dataDir, key);
      await fs3.unlink(filePath);
    } catch {
    }
  }
};
var DbCacheAdapter = class {
  constructor(db, agentId) {
    this.db = db;
    this.agentId = agentId;
  }
  async get(key) {
    return this.db.getCache({ agentId: this.agentId, key });
  }
  async set(key, value) {
    await this.db.setCache({ agentId: this.agentId, key, value });
  }
  async delete(key) {
    await this.db.deleteCache({ agentId: this.agentId, key });
  }
};
var CacheManager = class {
  adapter;
  constructor(adapter) {
    this.adapter = adapter;
  }
  async get(key) {
    const data = await this.adapter.get(key);
    if (data) {
      const { value, expires } = JSON.parse(data);
      if (!expires || expires > Date.now()) {
        return value;
      }
      this.adapter.delete(key).catch(() => {
      });
    }
    return void 0;
  }
  async set(key, value, opts) {
    return this.adapter.set(
      key,
      JSON.stringify({ value, expires: opts?.expires ?? 0 })
    );
  }
  async delete(key) {
    return this.adapter.delete(key);
  }
};
export {
  ActionTimelineType,
  AgentRuntime,
  CacheKeyPrefix,
  CacheManager,
  CacheStore,
  CharacterSchema,
  DatabaseAdapter,
  DbCacheAdapter,
  EmbeddingProvider,
  FsCacheAdapter,
  GoalStatus,
  IrysDataType,
  IrysMessageType,
  KnowledgeScope,
  LoggingLevel,
  MemoryCacheAdapter,
  MemoryManager,
  ModelClass,
  ModelProviderName,
  RAGKnowledgeManager,
  Service,
  ServiceType,
  TokenizerType,
  TranscriptionProvider,
  addHeader,
  booleanFooter,
  cleanJsonResponse,
  composeActionExamples,
  composeContext,
  composeRandomUser,
  configureSettings,
  createGoal,
  createRelationship,
  elizaLogger,
  embed,
  envSchema,
  evaluationTemplate,
  extractAttributes,
  findNearestEnvFile,
  formatActionNames,
  formatActions,
  formatActors,
  formatEvaluatorExampleDescriptions,
  formatEvaluatorExamples,
  formatEvaluatorNames,
  formatEvaluators,
  formatGoalsAsString,
  formatMessages,
  formatPosts,
  formatRelationships,
  formatTimestamp,
  generateCaption,
  generateImage,
  generateMessageResponse,
  generateObject,
  generateObjectArray,
  generateObjectDeprecated,
  generateShouldRespond,
  generateText,
  generateTextArray,
  generateTrueOrFalse,
  generateTweetActions,
  getActorDetails,
  getEmbeddingConfig,
  getEmbeddingModelSettings,
  getEmbeddingType,
  getEmbeddingZeroVector,
  getEndpoint,
  getEnvVariable,
  getGoals,
  getImageModelSettings,
  getModelSettings,
  getProviders,
  getRelationship,
  getRelationships,
  handleProvider,
  hasEnvVariable,
  knowledge_default as knowledge,
  loadEnvConfig,
  messageCompletionFooter,
  models,
  normalizeJsonString,
  parseActionResponseFromText,
  parseBooleanFromText,
  parseJSONObjectFromText,
  parseJsonArrayFromText,
  parseShouldRespondFromText,
  postActionResponseFooter,
  settings,
  shouldRespondFooter,
  splitChunks,
  splitText,
  stringArrayFooter,
  stringToUuid,
  trimTokens,
  truncateToCompleteSentence,
  updateGoal,
  uuidSchema,
  validateCharacterConfig,
  validateEnv,
  validateUuid
};
//# sourceMappingURL=index.js.map