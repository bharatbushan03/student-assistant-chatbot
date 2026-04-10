"use strict";

const DB_NAME = "miety_ai";
const ENABLE_OPTIONAL_TEXT_INDEXES = true;
const targetDb = db.getSiblingDB(DB_NAME);

const NUMBER_TYPES = ["double", "int", "long", "decimal"];
const NUMBER_OR_NULL_TYPES = ["double", "int", "long", "decimal", "null"];
const STRING_OR_NULL = { bsonType: ["string", "null"] };
const DATE_OR_NULL = { bsonType: ["date", "null"] };

const summary = {
  collections: {
    created: [],
    updated: [],
    errors: [],
  },
  indexes: {
    created: [],
    existing: [],
    errors: [],
  },
  seed: {
    status: "not-run",
    error: null,
  },
};

function getIndexSignature(key, options) {
  const unique = options && options.unique ? "1" : "0";
  const sparse = options && options.sparse ? "1" : "0";
  return `${JSON.stringify(Object.entries(key))}|u:${unique}|s:${sparse}`;
}

function isTextIndexSpec(key) {
  return Object.values(key).some((value) => value === "text");
}

function ensureCollection(name, validator) {
  try {
    const exists = targetDb.getCollectionInfos({ name }).length > 0;
    if (!exists) {
      targetDb.createCollection(name, {
        validator,
        validationLevel: "moderate",
        validationAction: "error",
      });
      summary.collections.created.push(name);
    } else {
      targetDb.runCommand({
        collMod: name,
        validator,
        validationLevel: "moderate",
        validationAction: "error",
      });
      summary.collections.updated.push(name);
    }
    return true;
  } catch (error) {
    summary.collections.errors.push(`${name}: ${error.codeName || error.name} - ${error.message}`);
    return false;
  }
}

function ensureIndexes(collectionName, specs) {
  const collection = targetDb.getCollection(collectionName);

  let existingIndexes;
  try {
    existingIndexes = collection.getIndexes();
  } catch (error) {
    summary.indexes.errors.push(
      `${collectionName}: ${error.codeName || error.name} - Unable to read existing indexes (${error.message})`
    );
    return;
  }

  for (const spec of specs) {
    const options = Object.assign({}, spec.options || {});
    const key = spec.key;

    if (!options.name) {
      options.name = Object.entries(key)
        .map(([k, v]) => `${k}_${v}`)
        .join("_");
    }

    const expectedFullName = `${collectionName}.${options.name}`;

    if (isTextIndexSpec(key)) {
      const existingText = existingIndexes.find((idx) => idx.key && idx.key._fts === "text");
      if (existingText) {
        summary.indexes.existing.push(`${collectionName}.${existingText.name}`);
        continue;
      }
    }

    const byName = existingIndexes.find((idx) => idx.name === options.name);
    if (byName) {
      summary.indexes.existing.push(expectedFullName);
      continue;
    }

    const targetSignature = getIndexSignature(key, options);
    const bySignature = existingIndexes.find((idx) => {
      if (idx.name === "_id_") {
        return false;
      }
      return getIndexSignature(idx.key, idx) === targetSignature;
    });

    if (bySignature) {
      summary.indexes.existing.push(`${collectionName}.${bySignature.name}`);
      continue;
    }

    try {
      collection.createIndex(key, options);
      summary.indexes.created.push(expectedFullName);
      existingIndexes = collection.getIndexes();
    } catch (error) {
      summary.indexes.errors.push(
        `${expectedFullName}: ${error.codeName || error.name} - ${error.message}`
      );
    }
  }
}

const validators = {
  users: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "password", "created_at", "updated_at"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}$",
          description: "Lowercase email address",
        },
        password: {
          bsonType: "string",
          description: "bcrypt hash",
        },
        role: {
          bsonType: "string",
          enum: ["student", "faculty", "admin"],
          description: "Default: student",
        },
        name: STRING_OR_NULL,
        college_id: STRING_OR_NULL,
        section: STRING_OR_NULL,
        semester: STRING_OR_NULL,
        project: STRING_OR_NULL,
        profile_picture: STRING_OR_NULL,
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },

  student_academics: {
    $jsonSchema: {
      bsonType: "object",
      required: ["student_id", "created_at", "updated_at"],
      properties: {
        student_id: { bsonType: "string" },
        student_email: STRING_OR_NULL,
        student_name: STRING_OR_NULL,
        section: STRING_OR_NULL,
        semester: STRING_OR_NULL,
        semester_results: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["semester"],
            properties: {
              semester: { bsonType: "string" },
              sgpa: {
                bsonType: NUMBER_OR_NULL_TYPES,
                minimum: 0,
                maximum: 10,
              },
              subjects: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["name", "marks"],
                  properties: {
                    name: { bsonType: "string" },
                    code: STRING_OR_NULL,
                    marks: {
                      bsonType: NUMBER_TYPES,
                      minimum: 0,
                      maximum: 100,
                    },
                    grade: STRING_OR_NULL,
                    attendance: {
                      bsonType: NUMBER_OR_NULL_TYPES,
                      minimum: 0,
                      maximum: 100,
                    },
                  },
                },
              },
            },
          },
        },
        sgpa_trend: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["semester", "sgpa"],
            properties: {
              semester: { bsonType: "string" },
              sgpa: {
                bsonType: NUMBER_TYPES,
                minimum: 0,
                maximum: 10,
              },
            },
          },
        },
        cgpa: {
          bsonType: NUMBER_OR_NULL_TYPES,
          minimum: 0,
          maximum: 10,
        },
        attendance_overall: {
          bsonType: NUMBER_OR_NULL_TYPES,
          minimum: 0,
          maximum: 100,
        },
        pending_tasks: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["title"],
            properties: {
              title: { bsonType: "string" },
              due_date: STRING_OR_NULL,
              priority: {
                bsonType: "string",
                enum: ["low", "medium", "high"],
                description: "Default: medium",
              },
            },
          },
        },
        updated_by: STRING_OR_NULL,
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },

  groups: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "created_by", "created_at", "updated_at"],
      properties: {
        name: { bsonType: "string" },
        description: { bsonType: "string" },
        avatar_url: STRING_OR_NULL,
        created_by: { bsonType: "string" },
        is_ai_enabled: {
          bsonType: "bool",
          description: "Default: true",
        },
        ai_auto_respond: {
          bsonType: "bool",
          description: "Default: false",
        },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },

  group_members: {
    $jsonSchema: {
      bsonType: "object",
      required: ["group_id", "user_id", "joined_at"],
      properties: {
        group_id: { bsonType: "string" },
        user_id: { bsonType: "string" },
        role: {
          bsonType: "string",
          enum: ["admin", "moderator", "member"],
          description: "Default: member",
        },
        joined_at: { bsonType: "date" },
      },
    },
  },

  group_files: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "group_id",
        "uploaded_by",
        "filename",
        "stored_name",
        "storage_path",
        "created_at",
        "updated_at",
      ],
      properties: {
        group_id: { bsonType: "string" },
        uploaded_by: { bsonType: "string" },
        filename: { bsonType: "string" },
        stored_name: { bsonType: "string" },
        storage_path: { bsonType: "string" },
        content_type: { bsonType: "string" },
        size_bytes: { bsonType: ["int", "long"], minimum: 0 },
        preview_text: { bsonType: "string" },
        extracted_text: { bsonType: "string" },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },

  messages: {
    $jsonSchema: {
      bsonType: "object",
      required: ["group_id", "sender_id", "sender_name", "content", "created_at"],
      properties: {
        group_id: { bsonType: "string" },
        sender_id: { bsonType: "string" },
        sender_name: { bsonType: "string" },
        sender_avatar: STRING_OR_NULL,
        content: { bsonType: "string" },
        message_type: {
          bsonType: "string",
          enum: ["text", "image", "file", "voice", "ai_response"],
          description: "Default: text",
        },
        reply_to_id: STRING_OR_NULL,
        is_edited: {
          bsonType: "bool",
          description: "Default: false",
        },
        edited_at: DATE_OR_NULL,
        metadata: { bsonType: "object" },
        status: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["user_id", "status"],
            properties: {
              user_id: { bsonType: "string" },
              status: {
                bsonType: "string",
                enum: ["sent", "delivered", "seen"],
              },
              seen_at: DATE_OR_NULL,
            },
          },
        },
        created_at: { bsonType: "date" },
      },
    },
  },

  message_reactions: {
    $jsonSchema: {
      bsonType: "object",
      required: ["message_id", "user_id", "emoji", "created_at"],
      properties: {
        message_id: { bsonType: "string" },
        user_id: { bsonType: "string" },
        emoji: { bsonType: "string" },
        created_at: { bsonType: "date" },
      },
    },
  },

  ai_context: {
    $jsonSchema: {
      bsonType: "object",
      required: ["group_id", "context_window", "last_updated"],
      properties: {
        group_id: { bsonType: "string" },
        context_window: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["role", "content", "timestamp"],
            properties: {
              role: {
                bsonType: "string",
                enum: ["user", "assistant"],
              },
              content: { bsonType: "string" },
              timestamp: { bsonType: "string" },
            },
          },
        },
        last_updated: { bsonType: "date" },
      },
    },
  },

  projects: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "owner_id", "created_at", "updated_at"],
      properties: {
        name: { bsonType: "string" },
        description: { bsonType: "string" },
        owner_id: { bsonType: "string" },
        metadata: { bsonType: "object" },
        settings: {
          bsonType: "object",
          properties: {
            include_project_files: { bsonType: "bool" },
            include_previous_chats: { bsonType: "bool" },
            model: { bsonType: "string" },
            temperature: {
              bsonType: NUMBER_TYPES,
              minimum: 0,
              maximum: 1.2,
            },
          },
        },
        shared_user_ids: {
          bsonType: "array",
          items: { bsonType: "string" },
        },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },

  project_chats: {
    $jsonSchema: {
      bsonType: "object",
      required: ["project_id", "owner_id", "created_at", "updated_at"],
      properties: {
        project_id: { bsonType: "string" },
        owner_id: { bsonType: "string" },
        title: { bsonType: "string" },
        is_pinned: { bsonType: "bool" },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
        last_message_at: { bsonType: "date" },
      },
    },
  },

  project_messages: {
    $jsonSchema: {
      bsonType: "object",
      required: ["project_id", "chat_id", "user_id", "content", "created_at"],
      properties: {
        project_id: { bsonType: "string" },
        chat_id: { bsonType: "string" },
        user_id: { bsonType: "string" },
        role: {
          bsonType: "string",
          enum: ["user", "assistant", "system"],
          description: "Default: user",
        },
        content: { bsonType: "string" },
        file_ids: {
          bsonType: "array",
          items: { bsonType: "string" },
        },
        citations: { bsonType: "array" },
        metadata: { bsonType: "object" },
        created_at: { bsonType: "date" },
      },
    },
  },

  project_files: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "project_id",
        "user_id",
        "filename",
        "stored_name",
        "storage_path",
        "created_at",
        "updated_at",
      ],
      properties: {
        project_id: { bsonType: "string" },
        user_id: { bsonType: "string" },
        filename: { bsonType: "string" },
        stored_name: { bsonType: "string" },
        storage_path: { bsonType: "string" },
        content_type: { bsonType: "string" },
        size_bytes: { bsonType: ["int", "long"], minimum: 0 },
        preview_text: { bsonType: "string" },
        extracted_text: { bsonType: "string" },
        embedding: {
          bsonType: "array",
          items: { bsonType: NUMBER_TYPES },
        },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
      },
    },
  },

  project_activity_logs: {
    $jsonSchema: {
      bsonType: "object",
      required: ["project_id", "user_id", "action", "created_at"],
      properties: {
        project_id: { bsonType: "string" },
        chat_id: STRING_OR_NULL,
        user_id: { bsonType: "string" },
        action: { bsonType: "string" },
        metadata: { bsonType: "object" },
        created_at: { bsonType: "date" },
      },
    },
  },
};

const collectionConfigs = [
  {
    name: "users",
    validator: validators.users,
    indexes: [
      { key: { email: 1 }, options: { name: "ux_users_email", unique: true } },
      { key: { college_id: 1 }, options: { name: "ix_users_college_id" } },
    ],
  },
  {
    name: "student_academics",
    validator: validators.student_academics,
    indexes: [
      { key: { student_id: 1 }, options: { name: "ux_student_academics_student_id", unique: true } },
      { key: { student_email: 1 }, options: { name: "ix_student_academics_student_email" } },
      { key: { section: 1, semester: 1 }, options: { name: "ix_student_academics_section_semester" } },
      { key: { updated_at: -1 }, options: { name: "ix_student_academics_updated_at_desc" } },
    ],
  },
  {
    name: "groups",
    validator: validators.groups,
    indexes: [
      {
        key: { created_by: 1, updated_at: -1 },
        options: { name: "ix_groups_created_by_updated_at_desc" },
      },
    ],
  },
  {
    name: "group_members",
    validator: validators.group_members,
    indexes: [
      {
        key: { group_id: 1, user_id: 1 },
        options: { name: "ux_group_members_group_user", unique: true },
      },
      { key: { user_id: 1 }, options: { name: "ix_group_members_user_id" } },
      { key: { group_id: 1, role: 1 }, options: { name: "ix_group_members_group_role" } },
    ],
  },
  {
    name: "group_files",
    validator: validators.group_files,
    indexes: [
      {
        key: { group_id: 1, created_at: -1 },
        options: { name: "ix_group_files_group_created_at_desc" },
      },
      {
        key: { uploaded_by: 1, created_at: -1 },
        options: { name: "ix_group_files_uploaded_by_created_at_desc" },
      },
    ],
  },
  {
    name: "messages",
    validator: validators.messages,
    indexes: [
      {
        key: { group_id: 1, created_at: -1 },
        options: { name: "ix_messages_group_created_at_desc" },
      },
      {
        key: { group_id: 1, sender_id: 1, created_at: -1 },
        options: { name: "ix_messages_group_sender_created_at_desc" },
      },
      { key: { reply_to_id: 1 }, options: { name: "ix_messages_reply_to_id" } },
    ],
    optionalIndexes: [
      { key: { content: "text" }, options: { name: "tx_messages_content" } },
    ],
  },
  {
    name: "message_reactions",
    validator: validators.message_reactions,
    indexes: [
      {
        key: { message_id: 1, user_id: 1, emoji: 1 },
        options: { name: "ux_message_reactions_message_user_emoji", unique: true },
      },
      { key: { message_id: 1 }, options: { name: "ix_message_reactions_message_id" } },
    ],
  },
  {
    name: "ai_context",
    validator: validators.ai_context,
    indexes: [
      { key: { group_id: 1 }, options: { name: "ux_ai_context_group_id", unique: true } },
      { key: { last_updated: -1 }, options: { name: "ix_ai_context_last_updated_desc" } },
    ],
  },
  {
    name: "projects",
    validator: validators.projects,
    indexes: [
      {
        key: { owner_id: 1, updated_at: -1 },
        options: { name: "ix_projects_owner_updated_at_desc" },
      },
      {
        key: { shared_user_ids: 1, updated_at: -1 },
        options: { name: "ix_projects_shared_user_ids_updated_at_desc" },
      },
    ],
  },
  {
    name: "project_chats",
    validator: validators.project_chats,
    indexes: [
      {
        key: { project_id: 1, is_pinned: -1, updated_at: -1 },
        options: { name: "ix_project_chats_project_pinned_updated_at_desc" },
      },
      {
        key: { project_id: 1, owner_id: 1 },
        options: { name: "ix_project_chats_project_owner" },
      },
      {
        key: { project_id: 1, last_message_at: -1 },
        options: { name: "ix_project_chats_project_last_message_at_desc" },
      },
    ],
  },
  {
    name: "project_messages",
    validator: validators.project_messages,
    indexes: [
      {
        key: { project_id: 1, chat_id: 1, created_at: -1 },
        options: { name: "ix_project_messages_project_chat_created_at_desc" },
      },
      {
        key: { project_id: 1, created_at: -1 },
        options: { name: "ix_project_messages_project_created_at_desc" },
      },
      {
        key: { chat_id: 1, created_at: -1 },
        options: { name: "ix_project_messages_chat_created_at_desc" },
      },
    ],
    optionalIndexes: [
      { key: { content: "text" }, options: { name: "tx_project_messages_content" } },
    ],
  },
  {
    name: "project_files",
    validator: validators.project_files,
    indexes: [
      {
        key: { project_id: 1, created_at: -1 },
        options: { name: "ix_project_files_project_created_at_desc" },
      },
      {
        key: { project_id: 1, user_id: 1, created_at: -1 },
        options: { name: "ix_project_files_project_user_created_at_desc" },
      },
    ],
  },
  {
    name: "project_activity_logs",
    validator: validators.project_activity_logs,
    indexes: [
      {
        key: { project_id: 1, created_at: -1 },
        options: { name: "ix_project_activity_logs_project_created_at_desc" },
      },
      {
        key: { project_id: 1, chat_id: 1, created_at: -1 },
        options: { name: "ix_project_activity_logs_project_chat_created_at_desc" },
      },
      {
        key: { user_id: 1, created_at: -1 },
        options: { name: "ix_project_activity_logs_user_created_at_desc" },
      },
    ],
  },
];

const readyCollections = new Set();

for (const config of collectionConfigs) {
  const ok = ensureCollection(config.name, config.validator);
  if (ok) {
    readyCollections.add(config.name);
  }
}

for (const config of collectionConfigs) {
  if (!readyCollections.has(config.name)) {
    continue;
  }

  const indexes = config.indexes.slice();
  if (ENABLE_OPTIONAL_TEXT_INDEXES && Array.isArray(config.optionalIndexes)) {
    indexes.push(...config.optionalIndexes);
  }

  ensureIndexes(config.name, indexes);
}

try {
  const usersCollection = targetDb.getCollection("users");
  const usersCount = usersCollection.countDocuments({});

  if (usersCount === 0) {
    const now = new Date();
    usersCollection.insertOne({
      email: "admin@mietjammu.in",
      password: "<REPLACE_WITH_BCRYPT_HASH>",
      role: "admin",
      name: "MIETY Admin",
      college_id: null,
      section: null,
      semester: null,
      project: null,
      profile_picture: null,
      created_at: now,
      updated_at: now,
    });
    summary.seed.status = "inserted";
  } else {
    summary.seed.status = "skipped";
  }
} catch (error) {
  summary.seed.status = "error";
  summary.seed.error = `${error.codeName || error.name} - ${error.message}`;
}

function printList(title, items) {
  print(`${title} (${items.length})`);
  if (items.length === 0) {
    print("  - none");
    return;
  }
  for (const item of items) {
    print(`  - ${item}`);
  }
}

print("\n=== MIETY AI MongoDB Initialization Summary ===");
print(`Database: ${DB_NAME}`);
printList("Collections created", summary.collections.created);
printList("Collections updated via collMod", summary.collections.updated);
printList("Collection errors", summary.collections.errors);
printList("Indexes created", summary.indexes.created);
printList("Indexes already present", summary.indexes.existing);
printList("Index errors", summary.indexes.errors);
print(`Admin seed status: ${summary.seed.status}`);
if (summary.seed.error) {
  print(`Admin seed error: ${summary.seed.error}`);
}

const hasErrors =
  summary.collections.errors.length > 0 ||
  summary.indexes.errors.length > 0 ||
  summary.seed.status === "error";

if (hasErrors) {
  print("\nInitialization completed with errors. Review summary above.");
  throw new Error("init_miety_ai.js completed with errors");
}

print("\nInitialization completed successfully.");